import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'
import { validateJwtAuthentication } from '~/src/api/common/helpers/jwt-auth.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const createOfferController = {
  handler: async (request, h) => {
    try {
      const agreementData = request.payload

      request.logger.info(
        `Creating agreement document with data: ${JSON.stringify(agreementData)}`
      )

      if (!agreementData) {
        throw Boom.internal('Agreement data is required')
      }

      // Validate JWT authentication based on feature flag
      if (
        !validateJwtAuthentication(
          request.headers['x-encrypted-auth'],
          agreementData,
          request.logger
        )
      ) {
        throw Boom.unauthorized(
          'Not authorized to create offer agreement document'
        )
      }

      // Accept the agreement
      await createOffer(uuidv4(), agreementData, request.logger)

      // Return the HTML response
      return h.response({ message: 'Agreement created' }).code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(`Error creating agreement document: ${error}`)
      return h
        .response({
          message: 'Failed to create agreement document',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { createOfferController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
