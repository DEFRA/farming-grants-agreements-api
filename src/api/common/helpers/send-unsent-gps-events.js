import { config } from '#~/config/index.js'
import { acceptOffer } from '#~/api/agreement/helpers/accept-offer.js'
import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'
import versionsModel from '#~/api/common/models/versions.js'
import grantModel from '#~/api/common/models/grant.js'
import { randomUUID } from 'node:crypto'

const paymentDayOfMonth = config.get('paymentDayOfMonth')

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

  let targetYear = date.getFullYear()
  let targetMonth = date.getMonth()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (date <= today) {
    targetMonth += 1
    const decIndex = 11
    if (targetMonth > decIndex) {
      targetMonth = 0
      targetYear += 1
    }
  }

  const adjustedDate = new Date(targetYear, targetMonth, paymentDayOfMonth)
  return adjustedDate.toISOString().split('T')[0]
}

/**
 * Process a single missed payment for an agreement
 * @param {object} version - Version document to process
 * @param {object} server - Server instance with logger
 */
async function processMissedPayment(version, server) {
  const agreementNumber = version.grant?.agreementNumber

  if (!agreementNumber) {
    server.logger.error(
      `Agreement number not found for version ${version._id.toString()}`
    )
    return
  }

  server.logger.info(
    `Processing missed payment for agreement ${agreementNumber}`
  )

  try {
    // Calculate payments based on parcels with actions
    const newPaymentData = await calculatePaymentsBasedOnParcelsWithActions({
      parcels: version.application.parcel,
      startDate: version.payment.agreementStartDate,
      logger: server.logger
    })

    for (const payment of newPaymentData.payments) {
      payment.paymentDate = calculateAdjustedPaymentDate(payment.paymentDate)
    }

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
  } catch (err) {
    server.logger.error(
      `Failed to process missed payment for agreement ${agreementNumber}: ${err.message}`
    )
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
        payments: newPaymentData.payments.map((payment) => ({
          ...payment,
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
    const isEnabled = config.get('featureFlags.sendUnsentGPSEvents')

    if (!isEnabled) {
      return
    }

    server.events.on('start', async () => {
      server.logger.info('Checking for missed GPS payments events...')

      try {
        const missedPayments = await findMissedPayments()

        server.logger.info(
          `Found ${missedPayments.length} agreements with missed GPS payment events`
        )

        for (const version of missedPayments) {
          await processMissedPayment(version, server)
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
