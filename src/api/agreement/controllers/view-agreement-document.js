import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import {
  renderTemplate,
  formatCurrency
} from '~/src/api/agreement/helpers/nunjucks-renderer.js'

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

      // Build dynamic actions array for the table
      const actions = (agreementData.parcels || []).flatMap((parcel) =>
        (parcel.activities ?? []).map((activity) => ({
          name: activity.description || activity.title || '',
          code: activity.code,
          landParcel: parcel.parcelNumber,
          quantity: activity.area ? `${activity.area} ha` : ''
        }))
      )

      // Build dynamic payments array for the Payments table
      const payments = (agreementData.payments?.activities || []).map(
        (activity) => ({
          name: activity.description,
          code: activity.code,
          rate: activity.paymentRate || activity.rate || '',
          quarterly: activity.quarterlyPayment || '', // If available
          yearly: activity.annualPayment
            ? `£${activity.annualPayment.toFixed(2)}`
            : ''
        })
      )
      const totalQuarterly = '' // Set this if you have quarterly totals in your data
      const totalYearly = agreementData.payments?.totalAnnualPayment
        ? `£${formatCurrency(Number(agreementData.payments.totalAnnualPayment) || 0)}`
        : ''

      // Render the Accept Agreement page
      const renderedHTML = renderTemplate('accept-agreement.njk', {
        agreementDocument: renderedAgreementDocument,
        agreementStatus: agreementData.status,
        agreementNumber: agreementData.agreementNumber,
        agreementSignatureDate: agreementData.signatureDate,
        agreementName: agreementData.agreementName,
        sbi: agreementData.sbi,
        company: agreementData.company,
        actions, // Pass dynamic actions array
        payments, // Pass dynamic payments array
        totalQuarterly,
        totalYearly
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
