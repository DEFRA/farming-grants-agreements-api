import path from 'node:path'

import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import { getAgreementDataById } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { getBaseUrl } from '~/src/api/common/helpers/base-url.js'
import { validateJwtAuthentication } from '~/src/api/common/helpers/jwt-auth.js'
import Boom from '@hapi/boom'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const viewAgreementController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params
      const baseUrl = getBaseUrl(request)

      const agreementData = await getAgreementDataById(agreementId)

      // Validate JWT authentication based on feature flag
      if (
        !validateJwtAuthentication(
          request.headers['x-encrypted-auth'],
          agreementData,
          request.logger
        )
      ) {
        throw Boom.unauthorized(
          'Not authorized to view offer agreement document'
        )
      }

      if (agreementData.status !== 'accepted') {
        return h.redirect(path.join(baseUrl, 'review-offer', agreementId))
      }

      request.logger.info(
        `Rendering HTML agreement document for agreementId: ${agreementId}`
      )

      // get HTML agreement
      const renderedHtml = await getHTMLAgreementDocument(
        agreementId,
        agreementData,
        baseUrl
      )

      // Return the HTML response
      return h
        .response(renderedHtml)
        .type('text/html')
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.ok)
    } catch (error) {
      // Let Boom errors pass through to the error handler
      if (error.isBoom) {
        throw error
      }

      request.logger.error(
        `Error rendering agreement document: ${error.message}`
      )
      request.logger.error(error.stack)
      return h
        .response({
          message: 'Failed to generate agreement document',
          error: error.message
        })
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.internalServerError)
    }
  }
}

export { viewAgreementController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
