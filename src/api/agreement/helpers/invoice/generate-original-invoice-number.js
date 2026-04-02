import countersModel from '#~/api/common/models/counters.js'

const CLAIM_ID_COUNTER = 'claimIds'
const INVOICE_NUMBER_PADDING = 3

/**
 * Format a claim ID number as a string with 'R' prefix and 8 digit padding
 * @param {number} seq - The sequence number
 * @returns {string} Formatted claim ID (e.g., 'R00000001')
 */
function formatClaimId(seq) {
  return `R${String(seq).padStart(8, '0')}`
}

/**
 * Generate a new claimId using the counter
 * @returns {Promise<string>} The new claim ID (e.g., 'R00000001')
 */
async function generateClaimId() {
  const counter = await countersModel.findOneAndUpdate(
    { _id: CLAIM_ID_COUNTER },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  )

  return formatClaimId(counter.seq)
}

/**
 * Generate invoice number from claimId, payment request number and due date
 * @param {string} claimId - The claim ID (e.g., 'R00000001')
 * @param {number} paymentRequestNumber - The payment request number
 * @returns {string} Invoice number in format: claimId-V00xQy (e.g., 'R00000001-V001Q2')
 */
function generateInvoiceNumber(claimId, paymentRequestNumber) {
  const paddedPaymentRequestNumber = `V${String(paymentRequestNumber).padStart(INVOICE_NUMBER_PADDING, '0')}`

  return `${claimId}-${paddedPaymentRequestNumber}QX`
}

export { generateClaimId, generateInvoiceNumber, formatClaimId }
