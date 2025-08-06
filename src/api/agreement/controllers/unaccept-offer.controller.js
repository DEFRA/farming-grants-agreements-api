import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { unacceptOffer } from '~/src/api/agreement/helpers/unaccept-offer.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import {
  extractJwtPayload,
  verifyJwtPayload
} from '~/src/api/common/helpers/jwt-auth.js'

/**
 * Controller to change the status of an agreement document back to offered
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const unacceptOfferController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params

      if (!agreementId || agreementId === '') {
        throw Boom.internalServerError('Agreement ID is required')
      }

      // Get the agreement data for authorization
      const agreementData = await getAgreementData({
        agreementNumber: agreementId
      })

      // Extract SBI from JWT token
      const jwtPayload = extractJwtPayload(
        request.headers['x-encrypted-auth'],
        request.logger
      )

      if (!jwtPayload || !verifyJwtPayload(jwtPayload, agreementData)) {
        return h
          .response({
            message: 'Not authorized to unaccept offer agreement document'
          })
          .code(statusCodes.unauthorized)
      }

      // Unaccept the agreement
      await unacceptOffer(agreementId)

      // Return the HTML response
      return h.response({ message: 'Offer unaccepted' }).code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(`Error unaccepting offer: ${error}`)
      return h
        .response({
          message: 'Failed to unaccept offer',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { unacceptOfferController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
