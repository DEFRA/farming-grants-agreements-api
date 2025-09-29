import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { unacceptOffer } from '~/src/api/agreement/helpers/unaccept-offer.js'

/**
 * Controller to change the status of an agreement document back to offered
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const postTestUnacceptOfferController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params

      if (!agreementId || agreementId === '') {
        throw Boom.internalServerError('Agreement ID is required')
      }

      // Unaccept the agreement
      await unacceptOffer(agreementId)

      // Return the HTML response
      return h.response({ message: 'Offer unaccepted' }).code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(error, 'Error unaccepting offer')
      return h
        .response({
          message: 'Failed to unaccept offer',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { postTestUnacceptOfferController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
