import Boom from '@hapi/boom'
import { getTestInvoiceController } from './get-test-invoice.controller.js'
import invoicesModel from '~/src/api/common/models/invoices.js'

vi.mock('~/src/api/common/models/invoices.js', () => ({
  default: {
    findOne: vi.fn()
  }
}))

describe('getTestInvoiceController', () => {
  const h = {
    response: vi.fn((payload) => ({
      code: vi.fn((status) => ({ payload, statusCode: status }))
    }))
  }

  const logger = { error: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns 200 with invoice data when found', async () => {
    const mockInvoice = {
      agreementNumber: 'FPTT123456789',
      invoiceNumber: 'INV-001',
      paymentHubRequest: { amount: 1000 }
    }

    const mockSort = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockInvoice)
    })

    invoicesModel.findOne.mockReturnValue({
      sort: mockSort
    })

    const request = { query: { agreementNumber: 'FPTT123456789' }, logger }
    const res = await getTestInvoiceController.handler(request, h)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual(mockInvoice)
    expect(invoicesModel.findOne).toHaveBeenCalledWith({
      agreementNumber: 'FPTT123456789'
    })
    expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 })
  })

  test('returns Boom 400 when agreementNumber query param is missing', async () => {
    const request = { query: {}, logger }
    const err = await getTestInvoiceController.handler(request, h)

    expect(Boom.isBoom(err)).toBe(true)
    expect(err.output.statusCode).toBe(400)
    expect(err.message).toBe('Missing agreementNumber query parameter')
  })

  test('returns Boom 404 when invoice not found', async () => {
    const mockSort = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    })

    invoicesModel.findOne.mockReturnValue({
      sort: mockSort
    })

    const request = { query: { agreementNumber: 'FPTT123456789' }, logger }
    const err = await getTestInvoiceController.handler(request, h)

    expect(Boom.isBoom(err)).toBe(true)
    expect(err.output.statusCode).toBe(404)
    expect(err.message).toBe(
      'Invoice not found for agreement number FPTT123456789'
    )
    expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 })
  })

  test('returns 500 when unexpected error occurs', async () => {
    const mockSort = vi.fn().mockReturnValue({
      lean: vi.fn().mockRejectedValue(new Error('db connection failed'))
    })

    invoicesModel.findOne.mockReturnValue({
      sort: mockSort
    })

    const request = { query: { agreementNumber: 'FPTT123456789' }, logger }
    const res = await getTestInvoiceController.handler(request, h)

    expect(res.statusCode).toBe(500)
    expect(res.payload).toEqual({
      message: 'Failed to fetch invoice',
      error: 'An unexpected error occurred'
    })
    expect(logger.error).toHaveBeenCalled()
    expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 })
  })
})
