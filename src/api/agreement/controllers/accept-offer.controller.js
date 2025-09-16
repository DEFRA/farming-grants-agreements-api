import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import {
  acceptOffer,
  getFirstPaymentDate
} from '~/src/api/agreement/helpers/accept-offer.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import { config } from '~/src/config/index.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const acceptOfferController = {
  handler: async (request, h) => {
    try {
      // Get the agreement data before accepting
      const { agreementData } = request.auth.credentials
      const { agreementNumber, status } = agreementData

      if (status === 'offered') {
        // Accept the agreement
        const agreementUrl = `${config.get('viewAgreementURI')}/${agreementNumber}`
        await acceptOffer(
          agreementNumber,
          agreementData,
          agreementUrl,
          request.logger
        )

        // Update the payment hub
        await updatePaymentHub(request, agreementNumber)
      }

      // Render the offer accepted template with agreement data
      return h
        .view('views/offer-accepted.njk', {
          nearestQuarterlyPaymentDate: getFirstPaymentDate(
            agreementData.payment.agreementStartDate
          )
        })
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(`Error accepting offer: ${error}`)
      return h
        .response({
          message: 'Failed to accept offer',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { acceptOfferController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
