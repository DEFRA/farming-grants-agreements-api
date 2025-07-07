import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'

/**
 * Controller to serve the View Offer page
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const reviewOfferController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params

      // Get the agreement data
      const agreementData = await getAgreementData({
        agreementNumber: agreementId
      })

      // Render the HTML agreement document
      const renderedAgreementDocument = await getHTMLAgreementDocument(
        agreementId,
        agreementData
      )

      // Render the Accept Agreement page
      const renderedHTML = renderTemplate('views/view-offer.njk', {
        agreementDocument: renderedAgreementDocument,
        agreementStatus: agreementData.status,
        agreementNumber: agreementData.agreementNumber,
        agreementSignatureDate: agreementData.signatureDate,
        grantsProxy: request.headers['defra-grants-proxy'] === 'true'
      })

      // Return the HTML response
      return h.response(renderedHTML).code(statusCodes.ok)
    } catch (error) {
      request.logger.error(`Error fetching offer: ${error.message}`)
      return h
        .response({
          message: 'Failed to fetch offer',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { reviewOfferController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
