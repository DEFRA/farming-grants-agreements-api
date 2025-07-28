import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'

/**
 * Controller to display the Accept Offer page
 * Renders a Nunjucks template with agreement data (no acceptance logic)
 * @satisfies {Partial<ServerRoute>}
 */
const displayAcceptOfferController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params

      // Get the agreement data
      const agreementData = await getAgreementData({
        agreementNumber: agreementId
      })

      if (!agreementData) {
        return h
          .response({
            message: 'Agreement not found',
            error: 'Not Found'
          })
          .code(statusCodes.notFound)
      }

      // Render the accept offer template with agreement data
      const acceptOfferTemplate = renderTemplate('views/accept-offer.njk', {
        agreementNumber: agreementData.agreementNumber,
        grantsProxy: request.headers['defra-grants-proxy'] === 'true',
        company: agreementData.company,
        sbi: agreementData.sbi,
        farmerName: agreementData.username
      })

      // Return the HTML response
      return h.response(acceptOfferTemplate).code(statusCodes.ok)
    } catch (error) {
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
