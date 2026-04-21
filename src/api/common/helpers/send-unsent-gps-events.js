import { config } from '#~/config/index.js'
import { sendGrantPaymentEvent } from '#~/api/common/helpers/send-grant-payment-event.js'
import versionsModel from '#~/api/common/models/versions.js'

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
        const missedPayments = await versionsModel
          .find({
            status: 'accepted',
            grantsPaymentServiceRequestMade: { $ne: true }
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

          // Attach agreementNumber to version object so sendGrantPaymentEvent can find it
          version.agreementNumber = agreementNumber

          try {
            await sendGrantPaymentEvent(
              version,
              server.logger || console // Fallback if server.logger is not available
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
      } catch (err) {
        server.logger.error(
          `Error while checking for missed GPS payments events: ${err.message}`
        )
      }
    })
  }
}

export { sendUnsetGPSEventsPlugin }
