import countersModel from '#~/api/common/models/counters.js'

const CLAIM_ID_COUNTER = 'claimIds'

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
  const monthsPerQuarter = 3
  const dateObj = new Date(date)
  const month = dateObj.getMonth() // 0-11
  const quarter = Math.floor(month / monthsPerQuarter) + 1
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
 * Generate invoice number based on claimId, version and quarter from due date
 * @param {string} claimId - The claim ID
 * @param {object} agreementData - The agreement data containing payment information
 * @param {object} agreementData.payment - Payment information
 * @param {string} agreementData.payment.payments[0].paymentDate - The first payment date
 * @param {number} agreementData.version - The agreement version
 * @returns {string} Invoice number in format: claimId-versionQuarter (e.g., 'R00000001-V001Q1')
 */
function generateInvoiceNumber(claimId, agreementData) {
  const dueDate = agreementData.payment?.payments?.[0]?.paymentDate
  const paymentRequestNumberPadding = 3
  const version = `V${String(agreementData.version).padStart(paymentRequestNumberPadding, '0')}`
  const quarter = getQuarter(dueDate)

  return `${claimId}-${version}${quarter}`
}

export { generateClaimId, generateInvoiceNumber, formatClaimId, getQuarter }
