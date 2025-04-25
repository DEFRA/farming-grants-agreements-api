import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { unacceptAgreement } from '~/src/api/agreement/helpers/unaccept-agreement.js'

/**
 * Controller to change the status of an agreement document back to offered
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const unacceptAgreementDocumentController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params

      if (!agreementId || agreementId === '') {
        throw Boom.internalServerError('Agreement ID is required')
      }

      // Unaccept the agreement
      await unacceptAgreement(agreementId)

      // Return the HTML response
      return h
        .response({ message: 'Agreement unaccepted' })
        .code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(`Error unaccepting agreement document: ${error}`)
      return h
        .response({
          message: 'Failed to unaccept agreement document',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { unacceptAgreementDocumentController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
