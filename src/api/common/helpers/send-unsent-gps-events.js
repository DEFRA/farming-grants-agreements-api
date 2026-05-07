import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import { config } from '#~/config/index.js'
import { acceptOffer } from '#~/api/agreement/helpers/accept-offer.js'
import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'
import versionsModel from '#~/api/common/models/versions.js'
import grantModel from '#~/api/common/models/grant.js'

const paymentDayOfMonth = config.get('paymentDayOfMonth')

/**
 * Check if value is a MongoDB BSON type (Decimal128, etc)
 * @param {object} value - Value to check
 * @returns {boolean} True if BSON type
 */
function isBsonType(value) {
  return (
    value._bsontype === 'Decimal128' ||
    (value._bsontype && typeof value.toString === 'function')
  )
}

/**
 * Check if value is a MongoDB ObjectId
 * @param {object} value - Value to check
 * @returns {boolean} True if ObjectId
 */
function isObjectId(value) {
  return (
    value._bsontype === 'ObjectId' || typeof value.toHexString === 'function'
  )
}

/**
 * Check if value is a Buffer or Uint8Array
 * @param {object} value - Value to check
 * @returns {boolean} True if Buffer type
 */
function isBufferType(value) {
  return Buffer.isBuffer(value) || value instanceof Uint8Array
}

/**
 * Deep clone a MongoDB document, converting ObjectId, Decimal128, and Buffer to strings
 * @param {object} value - Value to clone
 * @returns {object} Cloned value with MongoDB types converted to strings
 */
function deepCloneMongo(value) {
  if (value === null || value === undefined) {
    return value
  }

  if (isObjectId(value) || isBsonType(value)) {
    return value.toString()
  }

  if (isBufferType(value)) {
    return value.toString('hex')
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepCloneMongo(item))
  }

  if (typeof value === 'object') {
    const cloned = {}
    for (const key of Object.keys(value)) {
      cloned[key] = deepCloneMongo(value[key])
    }
    return cloned
  }

  return value
}

/**
 * Obfuscates personal data in the applicant section of a version object
 * @param {object} version - Version document
 * @returns {object} Cloned version with obfuscated personal data
 */
function obfuscatePersonalData(version) {
  const cloned = deepCloneMongo(version)
  const REDACTED = '[REDACTED]'

  function redactAllProps(obj) {
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          redactAllProps(obj[key])
        } else {
          obj[key] = REDACTED
        }
      }
    }
  }

  if (cloned.applicant) {
    if (cloned.applicant.business) {
      redactAllProps(cloned.applicant.business)
    }
    if (cloned.applicant.customer?.name) {
      redactAllProps(cloned.applicant.customer.name)
    }
  }

  return cloned
}

async function copyCollectionDontOverwrite(source, destination, logger) {
  // Skip if destination already exists
  if (await collectionExists(destination)) {
    throw new Error(
      `MongoDB collection: ${destination} already exists, cannot copy`
    )
  }

  // Copy source collection to destination collection
  await mongoose.model(source).aggregate([
    { $match: {} }, // Select all documents
    { $out: destination }
  ])

  logger.info(`MongoDB collection copied: ${source} to: ${destination}`)
}

/**
 * Check if a MongoDB collection exists
 * @param {string} collectionName - Name of collection to check
 * @returns {Promise<boolean>} True if collection exists
 */
async function collectionExists(collectionName) {
  const collections = await mongoose.connection.db.listCollections().toArray()
  return collections.map((c) => c.name).includes(collectionName)
}

/**
 * Copy collection from backup, taking a failsafe backup first
 * @param {string} backupSource - Backup collection name
 * @param {string} destination - Destination collection name
 * @param {object} logger - Logger instance
 */
async function restoreFromBackup(backupSource, destination, logger) {
  // Check if backup source exists
  if (!(await collectionExists(backupSource))) {
    throw new Error(`Backup collection ${backupSource} does not exist`)
  }

  // Take failsafe backup of current data if destination exists
  if (await collectionExists(destination)) {
    const failsafeName = `backup_failsafe_${destination}_${Date.now()}`
    await mongoose
      .model(destination)
      .aggregate([{ $match: {} }, { $out: failsafeName }])
    logger.info(`Failsafe backup created: ${destination} to: ${failsafeName}`)

    // Drop destination if it exists
    await mongoose.connection.db.dropCollection(destination)
    logger.info(`Dropped existing collection: ${destination}`)
  } else {
    logger.info(
      `Existing: ${destination} does not exist, no failsafe backup taken`
    )
  }

  // Copy from backup to destination
  await mongoose
    .model(backupSource)
    .aggregate([{ $match: {} }, { $out: destination }])

  logger.info(`Restored ${destination} from ${backupSource}`)
}

/**
 * Find agreements with missed GPS payment events
 * @returns {Promise<Array>} Array of version documents with missed payments
 */
async function findMissedPayments() {
  // Find grants with only one version
  const singleVersionGrants = await grantModel
    .find({ versions: { $size: 1 } })
    .select('_id')
    .lean()

  const grantIds = singleVersionGrants.map((g) => g._id.toString())

  // Find accepted versions with start date before 2026-05-01 belonging to single-version grants
  return versionsModel
    .find({
      status: 'accepted',
      grant: { $in: grantIds },
      'payment.agreementStartDate': { $lt: '2026-05-01' }
    })
    .populate('grant')
    .lean()
}

/**
 * Calculate adjusted payment date based on current date and payment day
 * Will add a month if the current date is after the payment day
 * @param {Date} currentPaymentDate - Original payment date
 * @returns {string} Date string in YYYY-MM-DD format
 */
function calculateAdjustedPaymentDate(currentPaymentDate) {
  const date = new Date(currentPaymentDate)
  date.setHours(0, 0, 0, 0)
  date.setDate(paymentDayOfMonth)

  const adjustedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    paymentDayOfMonth
  )
  return adjustedDate.toISOString().split('T')[0]
}

/**
 * Process a single missed payment for an agreement
 * @param {object} version - Version document to process
 * @param {object} server - Server instance with logger
 * @returns {Promise<object|undefined>} The new version document if successful, undefined otherwise
 */
async function processMissedPayment(version, server) {
  const agreementNumber = version.grant?.agreementNumber

  if (!agreementNumber) {
    server.logger.error(
      `Agreement number not found for version ${version._id.toString()}`
    )
    return undefined
  }

  server.logger.info(
    `Processing missed payment for agreement ${agreementNumber}`
  )

  try {
    // Calculate payments based on parcels with actions
    const newPaymentData = await calculatePaymentsBasedOnParcelsWithActions(
      version.application.parcel,
      server.logger
    )

    server.logger.info(`Creating new version of ${agreementNumber}`)

    const versionToProcess = await createNewVersionWithUpdatedPayment(
      version,
      newPaymentData,
      server.logger
    )

    server.logger.info(
      `Successfully created new version ${versionToProcess._id.toString()} for agreement ${agreementNumber}`
    )

    // Process the agreement acceptance with the full flow including payment event, SNS publishing, and audit logging
    await acceptOffer(
      agreementNumber,
      { agreementNumber, ...versionToProcess },
      server.logger,
      null
    )

    server.logger.info(
      `Successfully processed missed payment for agreement ${agreementNumber}`
    )

    return versionToProcess
  } catch (err) {
    server.logger.error(
      `Failed to process missed payment for agreement ${agreementNumber}: ${err.message}`
    )
    return undefined
  }
}

/**
 * Create a new version of the agreement with updated payment values
 * @param {object} currentVersion - Current version document
 * @param {object} newPaymentData - New payment calculation data
 * @param {object} logger - Logger instance
 * @returns {Promise<object>} The new version document
 */
async function createNewVersionWithUpdatedPayment(
  currentVersion,
  newPaymentData,
  logger
) {
  try {
    // Create new version object based on current version
    const newVersion = {
      ...currentVersion,
      createdAt: new Date(),
      updatedAt: new Date(),
      payment: {
        ...newPaymentData,
        agreementStartDate: currentVersion.payment.agreementStartDate,
        agreementEndDate: currentVersion.payment.agreementEndDate,
        payments: newPaymentData.payments.map((payment, idx) => ({
          ...payment,
          paymentDate: calculateAdjustedPaymentDate(
            currentVersion.payment.payments[idx].paymentDate
          ),
          correlationId: randomUUID()
        }))
      },
      correlationId: randomUUID()
    }

    // Remove fields that should not be copied
    delete newVersion._id // Let MongoDB generate new ID
    delete newVersion.__v
    delete newVersion.grant // This will be set by the model
    newVersion.notificationMessageId = randomUUID()

    // Insert the new version
    const createdVersion = await versionsModel.create(newVersion)

    // Link to parent grant
    await versionsModel.updateOne(
      { _id: createdVersion._id },
      { $set: { grant: currentVersion.grant._id } }
    )

    // Add new version to parent grant's versions array
    await grantModel.updateOne(
      { _id: currentVersion.grant._id },
      { $push: { versions: createdVersion._id } }
    )

    // Set the original version's status to cancelled
    await versionsModel.updateOne(
      { _id: currentVersion._id },
      { $set: { status: 'cancelled' } }
    )

    // Populate and return the new version
    return await versionsModel
      .findById(createdVersion._id)
      .populate('grant')
      .lean()
  } catch (error) {
    logger.error(`Failed to create new version: ${error.message}`)
    throw error
  }
}

const sendUnsetGPSEventsPlugin = {
  name: 'send-unsent-gps-events',
  version: '1.0.0',
  register: (server) => {
    const isSendUnsentGPSEventsEnabled = config.get(
      'featureFlags.sendUnsentGPSEvents'
    )
    const isRestoreFromBackupEnabled = config.get(
      'featureFlags.restoreGPSBackup'
    )

    if (!isSendUnsentGPSEventsEnabled && !isRestoreFromBackupEnabled) {
      return
    }

    server.events.on('start', async () => {
      if (isRestoreFromBackupEnabled) {
        server.logger.info('Restoring GPS backup collections...')

        try {
          await restoreFromBackup('backup_gps_grants', 'grants', server.logger)
          await restoreFromBackup(
            'backup_gps_versions',
            'versions',
            server.logger
          )

          server.logger.info('Successfully restored GPS backup collections')
        } catch (err) {
          server.logger.error(
            `Error while restoring GPS backup collections: ${err.message}`
          )
        }

        return
      }

      if (!isSendUnsentGPSEventsEnabled) {
        return
      }

      server.logger.info('Checking for missed GPS payments events...')

      try {
        await copyCollectionDontOverwrite(
          'grants',
          'backup_gps_grants',
          server.logger
        )
        await copyCollectionDontOverwrite(
          'versions',
          'backup_gps_versions',
          server.logger
        )

        const missedPayments = await findMissedPayments()

        server.logger.info(
          `Found ${missedPayments.length} agreements with missed GPS payment events`
        )

        for (const version of missedPayments) {
          const versionBefore = obfuscatePersonalData(version)
          server.logger.info(
            `Processing missed payment for version ${version._id?.toString?.() || version._id} - before: ${JSON.stringify(versionBefore, null, 2)}`
          )

          const newVersion = await processMissedPayment(version, server)

          const versionAfter = newVersion
            ? obfuscatePersonalData(newVersion)
            : { error: 'Failed to create new version' }
          server.logger.info(
            `Processed missed payment for version ${version._id?.toString?.() || version._id} - after: ${JSON.stringify(versionAfter, null, 2)}`
          )
        }
      } catch (err) {
        server.logger.error(
          `Error while checking for missed GPS payments events: ${err.message}`
        )
      }
    })
  }
}

export { sendUnsetGPSEventsPlugin }
