import { getBaseUrl } from '~/src/api/common/helpers/base-url.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { validateJwtAuthentication } from '~/src/api/common/helpers/jwt-auth.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const viewAgreementController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params

      const agreementData = await getAgreementData({
        agreementNumber: agreementId
      })

      // Validate JWT authentication based on feature flag
      if (
        !validateJwtAuthentication(
          request.headers['x-encrypted-auth'],
          agreementData,
          request.logger
        )
      ) {
        return h
          .response({
            message: 'Not authorized to view offer agreement document'
          })
          .code(statusCodes.unauthorized)
      }

      request.logger.info(
        `Rendering HTML agreement document for agreementId: ${agreementId}`
      )

      // get HTML agreement
      const renderedHtml = await getHTMLAgreementDocument(
        agreementId,
        agreementData,
        getBaseUrl(request)
      )

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

export { viewAgreementController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
