import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import { validateJwtAuthentication } from '~/src/api/common/helpers/jwt-auth.js'

/**
 * Flatten parcel activities to get land parcel and quantity
 * @param {object} agreementData
 * @returns {*[]} actions
 */
function flattenParcelActivities(agreementData) {
  const actions = []
  ;(agreementData.parcels || []).forEach((parcel) => {
    ;(parcel.activities ?? []).forEach((activity) => {
      actions.push({
        name:
          agreementData.actions?.find((a) => a.code === activity.code)?.title ??
          activity.code,
        code: activity.code,
        landParcel: parcel.parcelNumber,
        quantity: activity.area
      })
    })
  })
  return actions
}

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
            message: 'Not authorized to review offer agreement document'
          })
          .code(statusCodes.unauthorized)
      }

      // Render the HTML agreement document
      const renderedAgreementDocument = await getHTMLAgreementDocument(
        agreementId,
        agreementData
      )

      const actions = flattenParcelActivities(agreementData)

      // Map payments
      const payments = (agreementData.payments?.activities || []).map(
        (payment) => ({
          name: payment.description || payment.code,
          code: payment.code,
          rate: payment.rate,
          yearly: payment.annualPayment
        })
      )

      // Calculate totalYearly as the sum of the displayed payments
      const totalYearly = payments.reduce(
        (sum, payment) => sum + (payment.yearly || 0),
        0
      )

      // Calculate totalQuarterly as the sum of the displayed quarterly payments
      const totalQuarterly = payments.reduce(
        (sum, payment) => sum + (payment.yearly || 0) / 4,
        0
      )

      // Render the Accept Agreement page
      const renderedHTML = renderTemplate('views/view-offer.njk', {
        agreementDocument: renderedAgreementDocument,
        agreementStatus: agreementData.status,
        agreementNumber: agreementData.agreementNumber,
        agreementSignatureDate: agreementData.signatureDate,
        company: agreementData.company,
        sbi: agreementData.sbi,
        farmerName: agreementData.username,
        grantsProxy: request.headers['defra-grants-proxy'] === 'true',
        actions,
        payments,
        totalYearly,
        totalQuarterly,
        serviceName: 'Review funding offer',
        serviceUrl: '/'
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
