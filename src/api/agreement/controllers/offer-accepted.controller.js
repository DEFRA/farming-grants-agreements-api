import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getFirstPaymentDate } from '~/src/api/agreement/helpers/accept-offer.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const offerAcceptedController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.payload || request.params

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

      if (agreementData.status !== 'accepted') {
        throw Boom.badRequest('Agreement has not been accepted')
      }

      // Render the offer accepted template with agreement data
      const offerAcceptedTemplate = renderTemplate('views/offer-accepted.njk', {
        agreementNumber: agreementData.agreementNumber,
        grantsProxy: request.headers['defra-grants-proxy'] === 'true',
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
      request.logger.error(
        `Error displaying accept offer page: ${error.message}`
      )
      return h
        .response({
          message: 'Failed to display accept offer page',
          error: error.message
        })
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.badRequest)
    }
  }
}

export { offerAcceptedController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
