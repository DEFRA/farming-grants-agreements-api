import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import {
  acceptOffer,
  getFirstPaymentDate
} from '~/src/api/agreement/helpers/accept-offer.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const acceptOfferController = {
  handler: async (request, h) => {
    try {
      // Get the agreement data before accepting
      const { agreementData } = request.pre
      const { agreementNumber, status } = agreementData

      if (status === 'offered') {
        // Accept the agreement
        await acceptOffer(agreementData, request.logger)

        // Update the payment hub
        await updatePaymentHub(request, agreementNumber)
      }

      // Render the offer accepted template with agreement data
      return h
        .view('views/offer-accepted.njk', {
          agreementNumber: agreementData.agreementNumber,
          company: agreementData.company,
          sbi: agreementData.sbi,
          farmerName: agreementData.username,
          agreementStartDate: agreementData.agreementStartDate,
          nearestQuarterlyPaymentDate: getFirstPaymentDate(
            agreementData.agreementStartDate
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
