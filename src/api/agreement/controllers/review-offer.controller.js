import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Calculate total first payment from payments array
 * @param {Array} payments - Array of payment objects
 * @returns {number} Total first payment in pence
 */
const calculateTotalFirstPayment = (payments) => {
  return payments.reduce(
    (sum, payment) => sum + (payment.firstPaymentPence || 0),
    0
  )
}

/**
 * Calculate total subsequent payment from payments array
 * @param {Array} payments - Array of payment objects
 * @returns {number} Total subsequent payment in pence
 */
const calculateTotalSubsequentPayment = (payments) => {
  return payments.reduce(
    (sum, payment) => sum + (payment.subsequentPaymentPence || 0),
    0
  )
}

/**
 * Calculate first payment amount for a parcel item
 * @param {object} firstPayment - The first payment object
 * @param {string} key - The parcel item key
 * @returns {number} First payment amount in pence
 */
const calculateFirstPaymentForParcelItem = (firstPayment, key) => {
  return (
    firstPayment?.lineItems.find((li) => li.parcelItemId === Number(key))
      ?.paymentPence || 0
  )
}

/**
 * Calculate subsequent payment amount for a parcel item
 * @param {object} subsequentPayment - The subsequent payment object
 * @param {string} key - The parcel item key
 * @returns {number} Subsequent payment amount in pence
 */
const calculateSubsequentPaymentForParcelItem = (subsequentPayment, key) => {
  return (
    subsequentPayment?.lineItems.find((li) => li.parcelItemId === Number(key))
      ?.paymentPence || 0
  )
}

/**
 * Calculate first payment amount for an agreement level item
 * @param {object} firstPayment - The first payment object
 * @param {string} key - The agreement level item key
 * @returns {number} First payment amount in pence
 */
const calculateFirstPaymentForAgreementLevelItem = (firstPayment, key) => {
  return (
    firstPayment?.lineItems.find(
      (li) => li.agreementLevelItemId === Number(key)
    )?.paymentPence || 0
  )
}

/**
 * Calculate subsequent payment amount for an agreement level item
 * @param {object} subsequentPayment - The subsequent payment object
 * @param {string} key - The agreement level item key
 * @returns {number} Subsequent payment amount in pence
 */
const calculateSubsequentPaymentForAgreementLevelItem = (
  subsequentPayment,
  key
) => {
  return (
    subsequentPayment?.lineItems.find(
      (li) => li.agreementLevelItemId === Number(key)
    )?.paymentPence || 0
  )
}

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
          )?.paymentPence,
          firstPaymentPence: calculateFirstPaymentForParcelItem(
            payment.payments?.[0], // first payment
            key
          ),
          subsequentPaymentPence: calculateSubsequentPaymentForParcelItem(
            payment.payments?.[1], // subsequent payments
            key
          )
        })) || []),
        ...(Object.entries(payment?.agreementLevelItems || {}).map(
          ([key, i]) => ({
            ...i,
            description: `One-off payment per agreement per year for ${codeDescriptions[i.code]}`,
            rateInPence: i.annualPaymentPence,
            quarterlyPayment: quarterlyPayment?.lineItems.find(
              (li) => li.agreementLevelItemId === Number(key)
            )?.paymentPence,
            firstPaymentPence: calculateFirstPaymentForAgreementLevelItem(
              payment.payments?.[0], // first payment
              key
            ),
            subsequentPaymentPence:
              calculateSubsequentPaymentForAgreementLevelItem(
                payment.payments?.[1], // subsequent payments
                key
              )
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
          totalYearly: payment.annualTotalPence,
          totalFirstPayment: calculateTotalFirstPayment(payments),
          totalSubsequentPayment: calculateTotalSubsequentPayment(payments)
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
