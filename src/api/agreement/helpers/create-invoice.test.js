import { jest } from '@jest/globals'
import { createInvoice } from './create-invoice.js'
import invoicesModel from '~/src/api/common/models/invoices.js'
import Boom from '@hapi/boom'
import { v4 as uuidv4 } from 'uuid'

// Mock dependencies
jest.mock('~/src/api/common/models/invoices.js')
jest.mock('uuid')

describe('createInvoice', () => {
  const mockUuid = '123e4567-e89b-12d3-a456-426614174000'
  const mockAgreementId = 'SFI123456789'

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock uuid generation
    uuidv4.mockReturnValue(mockUuid)

    // Default mock for invoicesModel.find
    invoicesModel.find.mockResolvedValue([{}, {}, {}]) // 3 existing invoices
  })

  it('should create a new invoice with correct data', async () => {
    // Arrange
    const mockInvoice = {
      agreementNumber: mockAgreementId,
      invoiceNumber: 'FRPS3',
      correlationId: mockUuid
    }

    invoicesModel.create.mockResolvedValue(mockInvoice)

    // Act
    const result = await createInvoice(mockAgreementId)

    // Assert
    expect(invoicesModel.find).toHaveBeenCalledWith({})
    expect(invoicesModel.create).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId,
      invoiceNumber: 'FRPS4', // Index is 3 because we mocked 3 existing invoices
      correlationId: mockUuid
    })
    expect(result).toEqual(mockInvoice)
  })

  it('should generate invoice numbers sequentially based on existing invoices', async () => {
    // Arrange - mock different existing invoice counts
    invoicesModel.find.mockResolvedValue([]) // 0 existing invoices

    const mockInvoice = {
      agreementNumber: mockAgreementId,
      invoiceNumber: 'FRPS0',
      correlationId: mockUuid
    }

    invoicesModel.create.mockResolvedValue(mockInvoice)

    // Act
    const result = await createInvoice(mockAgreementId)

    // Assert
    expect(invoicesModel.create).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId,
      invoiceNumber: 'FRPS1', // Index is 0 because we mocked 0 existing invoices
      correlationId: mockUuid
    })
    expect(result).toEqual(mockInvoice)
  })

  it('should throw Boom.internal if invoicesModel.create throws an error', async () => {
    // Arrange
    const mockError = new Error('Database error')
    invoicesModel.create.mockRejectedValue(mockError)

    // Act & Assert
    await expect(createInvoice(mockAgreementId)).rejects.toThrow(
      Boom.internal(mockError).message
    )
  })

  it('should throw Boom.notFound if invoicesModel.create returns falsy value', async () => {
    // Arrange
    invoicesModel.create.mockResolvedValue(null)

    // Act & Assert
    await expect(createInvoice(mockAgreementId)).rejects.toThrow(
      Boom.notFound(`Invoice not created for Agreement ID ${mockAgreementId}`)
        .message
    )
  })

  it('should handle large number of existing invoices', async () => {
    // Arrange - mock a large number of existing invoices
    const largeNumber = 9999
    const mockInvoices = Array(largeNumber).fill({})
    invoicesModel.find.mockResolvedValue(mockInvoices)

    const mockInvoice = {
      agreementNumber: mockAgreementId,
      invoiceNumber: `FRPS${largeNumber}`,
      correlationId: mockUuid
    }

    invoicesModel.create.mockResolvedValue(mockInvoice)

    // Act
    const result = await createInvoice(mockAgreementId)

    // Assert
    expect(invoicesModel.create).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId,
      invoiceNumber: `FRPS10000`,
      correlationId: mockUuid
    })
    expect(result).toEqual(mockInvoice)
  })
})
