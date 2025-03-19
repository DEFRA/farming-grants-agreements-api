import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const getAgreementDocumentController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params

      // Get the agreement data
      const agreementData = await getAgreementData(agreementId, request)

      // Render the Nunjucks template with the data
      const templatePath = 'sfi-agreement.njk'
      const renderedHtml = renderTemplate(templatePath, agreementData)

      // Return the HTML response
      return h.response(renderedHtml).type('text/html').code(statusCodes.ok)
    } catch (error) {
      request.logger.error(
        `Error rendering agreement document: ${error.message}`
      )
      return h
        .response({
          message: 'Failed to generate agreement document',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { getAgreementDocumentController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
