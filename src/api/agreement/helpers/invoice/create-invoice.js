import Boom from '@hapi/boom'
import invoicesModel from '~/src/api/common/models/invoices.js'
import countersModel from '~/src/api/common/models/counters.js'

/**
 * Create a new invoice for the given agreement ID
 * @returns {object} The agreement data
 * @param {string} agreementId - The agreement ID to fetch
 * @param {string} correlationId - The correlation ID to use for the invoice
 * @returns {Invoice}
 */
async function createInvoice(agreementId, correlationId) {
  const counter = await countersModel.findOneAndUpdate(
    { _id: 'invoices' },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  )

  const invoice = await invoicesModel
    .create({
      agreementNumber: agreementId,
      invoiceNumber: `FRPS${counter.seq + 1}`,
      correlationId
    })
    .catch((error) => {
      throw Boom.internal(error)
    })

  if (!invoice) {
    throw Boom.notFound(`Invoice not created for Agreement ID ${agreementId}`)
  }

  return invoice
}

export { createInvoice }

/** @import { Invoice } from '~/src/api/common/types/invoice.d.js' */
