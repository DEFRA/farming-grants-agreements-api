import countersModel from '#~/api/common/models/counters.js'

const CLAIM_ID_COUNTER = 'claimIds'
const INVOICE_NUMBER_PADDING = 3
const MONTHS_PER_QUARTER = 3

/**
 * Format a claim ID number as a string with 'R' prefix and 8 digit padding
 * @param {number} seq - The sequence number
 * @returns {string} Formatted claim ID (e.g., 'R00000001')
 */
function formatClaimId(seq) {
  return `R${String(seq).padStart(8, '0')}`
}

/**
 * Get the quarter (Q1-Q4) from a date
 * @param {string|Date} date - The date to get the quarter from
 * @returns {string} The quarter (Q1, Q2, Q3, or Q4)
 */
function getQuarter(date) {
  const dateObj = new Date(date)
  const month = dateObj.getMonth() // 0-11
  const quarter = Math.floor(month / MONTHS_PER_QUARTER) + 1
  return `Q${quarter}`
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
 * @param {string|Date} dueDate - The due date used to determine the quarter
 * @returns {string} Invoice number in format: claimId-V00xQy (e.g., 'R00000001-V001Q2')
 */
function generateInvoiceNumber(claimId, paymentRequestNumber, dueDate) {
  const paddedPaymentRequestNumber = `V${String(paymentRequestNumber).padStart(INVOICE_NUMBER_PADDING, '0')}`
  const quarter = getQuarter(dueDate)

  return `${claimId}-${paddedPaymentRequestNumber}${quarter}`
}

export { generateClaimId, generateInvoiceNumber, formatClaimId }
