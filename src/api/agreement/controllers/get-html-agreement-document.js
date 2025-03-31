import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const getHTMLAgreementDocumentController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params

      // get HTML agreement
      const renderedHtml = await getHTMLAgreementDocument(agreementId)

      // Return the HTML response
      return h.response(renderedHtml).type('text/html').code(statusCodes.ok)
    } catch (error) {
      request.logger.error(
        `Error rendering agreement document: ${error.message}`
      )
      request.logger.error(error.stack)
      return h
        .response({
          message: 'Failed to generate agreement document',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { getHTMLAgreementDocumentController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
