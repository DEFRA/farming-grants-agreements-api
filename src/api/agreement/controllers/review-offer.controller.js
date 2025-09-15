import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Controller to serve the View Offer page
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const reviewOfferController = {
  handler: (request, h) => {
    try {
      const { agreementData: { actionApplications, payment } = {} } =
        request.auth.credentials

      const codeDescriptions = Object.values(payment.parcelItems).reduce(
        (prev, i) => ({
          ...prev,
          [i.code]: i.description.replace(`${i.code}: `, '')
        }),
        {}
      )

      const payments = [
        ...(Object.values(payment?.parcelItems, {}).map((i) => ({
          ...i,
          description: codeDescriptions[i.code],
          unit: i.unit.replace(/s$/, '')
        })) || []),
        ...(Object.values(payment?.agreementLevelItems, {}).map((i) => ({
          ...i,
          description: `One-off payment per agreement per year for ${codeDescriptions[i.code]}`,
          rateInPence: i.annualPaymentPence
        })) || [])
      ].sort((a, b) => b.code.localeCompare(a.code))

      // Render the page with base context automatically applied
      return h
        .view('views/view-offer.njk', {
          actionApplications,
          codeDescriptions,
          payments,
          totalQuarterly: payment.annualTotalPence / 4,
          totalYearly: payment.annualTotalPence
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
