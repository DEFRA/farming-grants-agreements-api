import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const viewAgreementDocumentController = {
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
      const renderedHTML = renderTemplate('accept-agreement.njk', {
        agreementDocument: renderedAgreementDocument,
        agreementStatus: agreementData.status,
        agreementNumber: agreementData.agreementNumber,
        agreementSignatureDate: agreementData.signatureDate,
        agreementName: agreementData.agreementName,
        sbi: agreementData.sbi,
        company: agreementData.company
      })

      // Return the HTML response
      return h.response(renderedHTML).code(statusCodes.ok)
    } catch (error) {
      request.logger.error(
        `Error fetching agreement document: ${error.message}`
      )
      return h
        .response({
          message: 'Failed to fetch agreement document',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { viewAgreementDocumentController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
