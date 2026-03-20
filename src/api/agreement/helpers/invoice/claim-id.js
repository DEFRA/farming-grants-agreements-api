import invoicesModel from '#~/api/common/models/invoices.js'
import { formatClaimId } from '#~/api/agreement/helpers/invoice/generate-original-invoice-number.js'
import countersModel from '#~/api/common/models/counters.js'

const CLAIM_ID_COUNTER = 'claimIds'

/**
 * Generate a new claimId using the counter
 * @returns {Promise<string>} The new claim ID
 */
async function generateNewClaimId() {
  const counter = await countersModel.findOneAndUpdate(
    { _id: CLAIM_ID_COUNTER },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  )

  return formatClaimId(counter.seq)
}

/**
 * Get the claimId for an agreement
 * - If claimId exists in agreementData, use it
 * - Otherwise, fallback to finding it from existing invoices
 * @param {string} agreementId - The agreement ID
 * @param {Agreement} agreementData - The agreement data
 * @returns {Promise<string>} The claim ID
 */
async function getClaimId(agreementId, agreementData) {
  // First check if claimId is stored in agreement data
  if (agreementData.claimId) {
    return agreementData.claimId
  }

  // Fallback: Find the first invoice for this agreement to get the existing claimId
  const existingInvoice = await invoicesModel
    .findOne({ agreementNumber: agreementId })
    .sort({ createdAt: 1 })
    .lean()

  if (existingInvoice?.claimId) {
    return existingInvoice.claimId
  }

  // Generate a new claimId if version is 1 or no existing claimId found
  return generateNewClaimId()
}

export { getClaimId }

/** @import { Invoice } from '#~/api/common/types/invoice.d.js' */
/** @import { Agreement } from '#~/api/common/types/agreement.d.js' */
