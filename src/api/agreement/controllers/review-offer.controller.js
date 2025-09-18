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

      const quarterlyPayment = payment.payments?.[payment.payments?.length - 1]

      const payments = [
        ...(Object.entries(payment?.parcelItems || {}).map(([key, i]) => ({
          ...i,
          description: codeDescriptions[i.code],
          unit: i.unit.replace(/s$/, ''),
          quarterlyPayment: quarterlyPayment?.lineItems.find(
            (li) => li.parcelItemId === Number(key)
          )?.paymentPence
        })) || []),
        ...(Object.entries(payment?.agreementLevelItems || {}).map(
          ([key, i]) => ({
            ...i,
            description: `One-off payment per agreement per year for ${codeDescriptions[i.code]}`,
            rateInPence: i.annualPaymentPence,
            quarterlyPayment: quarterlyPayment?.lineItems.find(
              (li) => li.agreementLevelItemId === Number(key)
            )?.paymentPence
          })
        ) || [])
      ].sort((a, b) => a.code.localeCompare(b.code))

      // Render the page with base context automatically applied
      return h
        .view('views/view-offer.njk', {
          actionApplications,
          codeDescriptions,
          payments,
          totalQuarterly: quarterlyPayment?.totalPaymentPence,
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
