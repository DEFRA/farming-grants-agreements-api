import path from 'node:path'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementDataById } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import { getBaseUrl } from '~/src/api/common/helpers/base-url.js'
import { validateJwtAuthentication } from '~/src/api/common/helpers/jwt-auth.js'
import Boom from '@hapi/boom'

/**
 * Controller to display the Accept Offer page
 * Renders a Nunjucks template with agreement data (no acceptance logic)
 * @satisfies {Partial<ServerRoute>}
 */
const displayAcceptOfferController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params
      const baseUrl = getBaseUrl(request)

      // Get the agreement data
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
          'Not authorized to display accept offer agreement document'
        )
      }

      if (agreementData.status !== 'offered') {
        return h.redirect(path.join(baseUrl, 'offer-accepted', agreementId))
      }

      // Render the accept offer template with agreement data
      const acceptOfferTemplate = renderTemplate('views/accept-offer.njk', {
        agreementNumber: agreementData.agreementNumber,
        baseUrl,
        company: agreementData.company,
        sbi: agreementData.sbi,
        farmerName: agreementData.username,
        status: agreementData.status
      })

      // Return the HTML response
      return h
        .response(acceptOfferTemplate)
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.ok)
    } catch (error) {
      // Let Boom errors pass through to the error handler
      if (error.isBoom) {
        throw error
      }

      request.logger.error(
        `Error displaying accept offer page: ${error.message}`
      )
      return h
        .response({
          message: 'Failed to display accept offer page',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { displayAcceptOfferController }
