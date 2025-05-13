import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { createAgreement } from '~/src/api/agreement/helpers/create-agreement.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const createAgreementDocumentController = {
  handler: async (request, h) => {
    try {
      const agreementData = request.payload

      request.logger.info(
        `Creating agreement document with data: ${JSON.stringify(agreementData)}`
      )

      if (!agreementData) {
        throw Boom.internal('Agreement data is required')
      }

      // Accept the agreement
      await createAgreement(agreementData)

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

export { createAgreementDocumentController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
