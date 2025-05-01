import Boom from '@hapi/boom'
import invoicesModel from '~/src/api/common/models/invoices.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Create a new invoice for the given agreement ID
 * @returns {object} The agreement data
 * @param {string} agreementId - The agreement ID to fetch
 * @returns {Invoice}
 */
async function createInvoice(agreementId) {
  const index = (await invoicesModel.find({})).length
  const invoice = await invoicesModel
    .create({
      agreementNumber: agreementId,
      invoiceNumber: `FRPS${index + 1}`,
      correlationId: uuidv4()
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
