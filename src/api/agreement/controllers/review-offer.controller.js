import { statusCodes } from '~/src/api/common/constants/status-codes.js'

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
  handler: (request, h) => {
    try {
      const { agreementData } = request.auth.credentials

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

      // Render the page with base context automatically applied
      return h
        .view('views/view-offer.njk', {
          agreementStatus: agreementData.status,
          agreementNumber: agreementData.agreementNumber,
          agreementSignatureDate: agreementData.signatureDate,
          company: agreementData.company,
          sbi: agreementData.sbi,
          farmerName: agreementData.username,
          actions,
          payments,
          totalYearly,
          totalQuarterly
        })
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.ok)
    } catch (error) {
      // Let Boom errors pass through to the error handler
      if (error.isBoom) {
        throw error
      }

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
