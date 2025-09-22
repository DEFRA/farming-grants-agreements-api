/**
 * Calculate first payment amount for a parcel item
 * @param {object} firstPayment - The first payment object
 * @param {string} key - The parcel item key
 * @returns {number} First payment amount in pence
 */
const calculateFirstPaymentForParcelItem = (firstPayment, key) => {
  return (
    firstPayment?.lineItems?.find((li) => li.parcelItemId === Number(key))
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
    subsequentPayment?.lineItems?.find((li) => li.parcelItemId === Number(key))
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
    firstPayment?.lineItems?.find(
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
    subsequentPayment?.lineItems?.find(
      (li) => li.agreementLevelItemId === Number(key)
    )?.paymentPence || 0
  )
}

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

export {
  calculateFirstPaymentForParcelItem,
  calculateSubsequentPaymentForParcelItem,
  calculateFirstPaymentForAgreementLevelItem,
  calculateSubsequentPaymentForAgreementLevelItem,
  calculateTotalFirstPayment,
  calculateTotalSubsequentPayment
}
