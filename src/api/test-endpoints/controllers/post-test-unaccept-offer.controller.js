import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { unacceptOffer } from '~/src/api/agreement/helpers/unaccept-offer.js'

/**
 * Controller to change the status of an agreement document back to offered
 * Returns JSON data with operation result
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
      await unacceptOffer(agreementId, { all: true })

      // Return JSON response
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
