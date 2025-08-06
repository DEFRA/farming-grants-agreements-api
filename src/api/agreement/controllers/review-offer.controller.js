import path from 'node:path'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import { getBaseUrl } from '~/src/api/common/helpers/base-url.js'

/**
 * Controller to serve the View Offer page
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const reviewOfferController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params
      const baseUrl = getBaseUrl(request)

      // Get the agreement data
      const agreementData = await getAgreementData({
        agreementNumber: agreementId
      })

      if (agreementData.status === 'accepted') {
        return h.redirect(path.join(baseUrl, 'offer-accepted', agreementId))
      }

      // Render the HTML agreement document
      const renderedAgreementDocument = await getHTMLAgreementDocument(
        agreementId,
        agreementData,
        baseUrl
      )

      // Map actions: flatten parcel activities to get land parcel and quantity
      const actions = []
      ;(agreementData.parcels || []).forEach((parcel) => {
        ;(parcel.activities ?? []).forEach((activity) => {
          actions.push({
            name:
              agreementData.actions?.find((a) => a.code === activity.code)
                ?.title ?? activity.code,
            code: activity.code,
            landParcel: parcel.parcelNumber,
            quantity: activity.area
          })
        })
      })

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
        baseUrl,
        actions,
        payments,
        totalYearly,
        totalQuarterly,
        serviceName: 'Review funding offer',
        serviceUrl: '/'
      })

      // Return the HTML response
      return h
        .response(renderedHTML)
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.ok)
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
