import Boom from '@hapi/boom'
import invoicesModel from '~/src/api/common/models/invoices.js'

/**
 * Create a new invoice for the given agreement ID
 * @returns {object} The agreement data
 * @param {string} invoiceNumber - The invoice number to update
 * @param {object} updateData - The data to update the invoice with
 * @returns {Invoice}
 */
async function updateInvoice(invoiceNumber, updateData) {
  const invoice = await invoicesModel
    .updateOne(
      {
        invoiceNumber
      },
      {
        $set: updateData
      }
    )
    .catch((error) => {
      throw Boom.internal(error)
    })

  if (!invoice) {
    throw Boom.notFound(`Invoice not found for Invoice Number ${invoiceNumber}`)
  }

  return invoice
}

export { updateInvoice }

/** @import { Invoice } from '~/src/api/common/types/invoice.d.js' */
