import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import {
  extractJwtPayload,
  verifyJwtPayload
} from '~/src/api/common/helpers/jwt-auth.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const viewAgreementController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params

      // Extract SBI from JWT token
      const jwtPayload = extractJwtPayload(
        request.headers['x-encrypted-auth'],
        request.logger
      )

      const agreementData = await getAgreementData({
        agreementNumber: agreementId
      })
      if (!jwtPayload || !verifyJwtPayload(jwtPayload, agreementData)) {
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
        request.headers['defra-grants-proxy'] === 'true'
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
