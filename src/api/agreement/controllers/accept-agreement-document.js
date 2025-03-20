import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptAgreement } from '~/src/api/agreement/helpers/accept-agreement-data.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const acceptAgreementDocumentController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params
      const { username } = request.payload

      // Get the agreement data
      await acceptAgreement(agreementId, request.logger, username)

      // Return the HTML response
      return h.response({ message: 'Agreement accepted' }).code(statusCodes.ok)
    } catch (error) {
      request.logger.error(
        `Error accepting agreement document: ${error.message}`
      )
      return h
        .response({
          message: 'Failed to accept agreement document',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { acceptAgreementDocumentController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
