import Boom from '@hapi/boom'
import invoicesModel from '~/src/api/common/models/invoices.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * GET /api/test/invoice?agreementNumber={?}
 * Fetch invoice data by agreement number
 * @satisfies {Partial<ServerRoute>}
 */
const getTestInvoiceController = {
  handler: async (request, h) => {
    try {
      const { agreementNumber } = request.query

      if (!agreementNumber) {
        throw Boom.badRequest('Missing agreementNumber query parameter')
      }

      const invoice = await invoicesModel.findOne({ agreementNumber }).lean()

      if (!invoice) {
        throw Boom.notFound(
          `Invoice not found for agreement number ${agreementNumber}`
        )
      }

      return h.response(invoice).code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }
      request.logger?.error?.(`Error fetching invoice: ${error}`)
      return h
        .response({
          message: 'Failed to fetch invoice',
          error: 'An unexpected error occurred'
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { getTestInvoiceController }
