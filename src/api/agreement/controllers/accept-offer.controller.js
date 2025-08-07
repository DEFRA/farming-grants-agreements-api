import path from 'node:path'
import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import {
  acceptOffer,
  getFirstPaymentDate
} from '~/src/api/agreement/helpers/accept-offer.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { validateJwtAuthentication } from '~/src/api/common/helpers/jwt-auth.js'
import { getBaseUrl } from '~/src/api/common/helpers/base-url.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const acceptOfferController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.payload || request.params
      const baseUrl = getBaseUrl(request)

      if (!agreementId || agreementId === '') {
        throw Boom.badRequest('Agreement ID is required')
      }

      // Get the agreement data before accepting
      const agreementData = await getAgreementData({
        agreementNumber: agreementId
      })

      if (!agreementData) {
        throw Boom.notFound(`Agreement not found with ID ${agreementId}`)
      }

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
            message: 'Not authorized to accept offer agreement document'
          })
          .code(statusCodes.unauthorized)
      }

      if (request.method === 'post') {
        if (agreementData.status !== 'offered') {
          return h.redirect(path.join(baseUrl, 'offer-accepted', agreementId))
        }

        // Accept the agreement
        await acceptOffer(agreementId)

        // Update the payment hub
        await updatePaymentHub(request, agreementId)
      } else if (agreementData.status !== 'accepted') {
        return h.redirect(path.join(baseUrl, 'review-offer', agreementId))
      }

      // Render the offer accepted template with agreement data
      const offerAcceptedTemplate = renderTemplate('views/offer-accepted.njk', {
        agreementNumber: agreementData.agreementNumber,
        baseUrl,
        company: agreementData.company,
        sbi: agreementData.sbi,
        farmerName: agreementData.username,
        agreementStartDate: agreementData.agreementStartDate,
        nearestQuarterlyPaymentDate: getFirstPaymentDate(
          agreementData.agreementStartDate
        )
      })

      // Return the HTML response
      return h
        .response(offerAcceptedTemplate)
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(`Error accepting offer: ${error}`)
      return h
        .response({
          message: 'Failed to accept offer',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { acceptOfferController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
