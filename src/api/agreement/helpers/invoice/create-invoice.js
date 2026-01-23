import Boom from '@hapi/boom'
import invoicesModel from '~/src/api/common/models/invoices.js'
import countersModel from '~/src/api/common/models/counters.js'

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
 * - If version > 1, returns the existing claimId from the first invoice (or generates new if not found)
 * - If version = 1, generates a new claimId using the counter
 * @param {string} agreementId - The agreement ID
 * @param {number} version - The agreement version
 * @returns {Promise<string>} The claim ID
 */
async function getOrCreateClaimId(agreementId, version) {
  if (version > 1) {
    // Find the first invoice for this agreement to get the existing claimId
    const existingInvoice = await invoicesModel
      .findOne({ agreementNumber: agreementId })
      .sort({ createdAt: 1 })
      .lean()

    if (existingInvoice?.claimId) {
      return existingInvoice.claimId
    }
  }

  // Generate a new claimId if version is 1 or no existing claimId found
  return generateNewClaimId()
}

/**
 * Create a new invoice for the given agreement ID
 * @param {string} agreementId - The agreement ID to fetch
 * @param {Agreement} agreementData - The agreement data containing version info
 * @returns {Promise<Invoice>} The created invoice
 */
async function createInvoice(agreementId, agreementData) {
  const counter = await countersModel.findOneAndUpdate(
    { _id: 'invoices' },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  )

  const claimId = await getOrCreateClaimId(agreementId, agreementData.version)

  const invoice = await invoicesModel
    .create({
      agreementNumber: agreementId,
      invoiceNumber: `FRPS${counter.seq + 1}`,
      correlationId: agreementData.correlationId,
      claimId
    })
    .catch((error) => {
      throw Boom.internal(error)
    })

  if (!invoice) {
    throw Boom.notFound(`Invoice not created for Agreement ID ${agreementId}`)
  }

  return invoice
}

export { createInvoice, formatClaimId, getOrCreateClaimId }

/** @import { Invoice } from '~/src/api/common/types/invoice.d.js' */
/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
