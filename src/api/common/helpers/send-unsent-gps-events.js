import { config } from '#~/config/index.js'
import { sendGrantPaymentEvent } from '#~/api/common/helpers/send-grant-payment-event.js'
import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'
import versionsModel from '#~/api/common/models/versions.js'
import agreementsModel from '#~/api/common/models/agreements.js'
import { randomUUID } from 'node:crypto'

/**
 * Compare two payment objects to check if values have changed
 * @param {object} oldPayment - Existing payment object
 * @param {object} newPayment - Newly calculated payment object
 * @returns {boolean} True if payment values have changed
 */
function hasPaymentValuesChanged(oldPayment, newPayment) {
  if (!oldPayment || !newPayment) return true

  // Compare key payment fields
  const keyFields = [
    'agreementTotalPence',
    'annualTotalPence',
    'agreementStartDate',
    'agreementEndDate',
    'frequency'
  ]

  for (const field of keyFields) {
    if (oldPayment[field] !== newPayment[field]) {
      return true
    }
  }

  // Compare payments array
  const oldPayments = oldPayment.payments || []
  const newPayments = newPayment.payments || []

  if (oldPayments.length !== newPayments.length) {
    return true
  }

  for (let i = 0; i < oldPayments.length; i++) {
    const oldPaymentItem = oldPayments[i]
    const newPaymentItem = newPayments[i]

    if (
      oldPaymentItem.totalPaymentPence !== newPaymentItem.totalPaymentPence ||
      oldPaymentItem.paymentDate !== newPaymentItem.paymentDate
    ) {
      return true
    }
  }

  return false
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
      _id: undefined, // Let MongoDB generate new ID
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
    delete newVersion.__v
    delete newVersion.agreement // This will be set by the model

    // Insert the new version
    const createdVersion = await versionsModel.create(newVersion)

    // Link to parent agreement
    await versionsModel.updateOne(
      { _id: createdVersion._id },
      { $set: { agreement: currentVersion.agreement._id } }
    )

    // Add new version to parent agreement's versions array
    await agreementsModel.updateOne(
      { _id: currentVersion.agreement._id },
      { $push: { versions: createdVersion._id } }
    )

    // Populate and return the new version
    return await versionsModel
      .findById(createdVersion._id)
      .populate('agreement')
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
        // Find agreements with only one version
        const singleVersionAgreements = await agreementsModel
          .find({ versions: { $size: 1 } })
          .select('_id')
          .lean()

        const agreementIds = singleVersionAgreements.map((a) =>
          a._id.toString()
        )

        // Find accepted versions with start date before 2026-05-01 belonging to single-version agreements
        const missedPayments = await versionsModel
          .find({
            status: 'accepted',
            agreement: { $in: agreementIds },
            'payment.agreementStartDate': { $lt: '2026-05-01' }
          })
          .populate('agreement')
          .lean()

        server.logger.info(
          `Found ${missedPayments.length} agreements with missed GPS payment events`
        )

        for (const version of missedPayments) {
          const agreementNumber = version.agreement?.agreementNumber

          if (!agreementNumber) {
            server.logger.error(
              `Agreement number not found for version ${version._id.toString()}`
            )
            continue
          }

          server.logger.info(
            `Processing missed payment for agreement ${agreementNumber}`
          )

          try {
            // Calculate payments based on parcels with actions
            const newPaymentData =
              await calculatePaymentsBasedOnParcelsWithActions(
                version.application.parcel,
                server.logger
              )

            // Check if payment values have changed
            const paymentValuesChanged = hasPaymentValuesChanged(
              version.payment,
              newPaymentData
            )

            let versionToProcess = version

            if (paymentValuesChanged) {
              server.logger.info(
                `Payment values have changed for agreement ${agreementNumber}, creating new version`
              )

              // Create new version with updated payment values
              versionToProcess = await createNewVersionWithUpdatedPayment(
                version,
                newPaymentData,
                server.logger
              )

              server.logger.info(
                `Successfully created new version ${versionToProcess._id.toString()} for agreement ${agreementNumber}`
              )
            } else {
              server.logger.info(
                `Payment values unchanged for agreement ${agreementNumber}, using existing version`
              )
            }

            // Attach agreementNumber to version object so sendGrantPaymentEvent can find it
            versionToProcess.agreementNumber = agreementNumber

            await sendGrantPaymentEvent(versionToProcess, server.logger)

            server.logger.info(
              `Successfully processed missed payment for agreement ${agreementNumber}`
            )
          } catch (err) {
            server.logger.error(
              `Failed to process missed payment for agreement ${agreementNumber}: ${err.message}`
            )
          }
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
