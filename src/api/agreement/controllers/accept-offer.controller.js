import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const acceptOfferController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.payload || request.params

      if (!agreementId || agreementId === '') {
        throw Boom.badRequest('Agreement ID is required')
      }

      // Accept the agreement
      await acceptOffer(agreementId)

      // Update the payment hub
      await updatePaymentHub(request, agreementId)

      // Render the offer accepted template
      const offerAcceptedTemplate = renderTemplate(
        'views/offer-accepted.njk',
        null,
        request.headers['defra-grants-proxy'] === 'true'
      )

      // Return the HTML response
      return h.response(offerAcceptedTemplate).code(statusCodes.ok)
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
