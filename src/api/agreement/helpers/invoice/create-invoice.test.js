import { vi } from 'vitest'
import { createInvoice } from './create-invoice.js'
import invoicesModel from '~/src/api/common/models/invoices.js'
import countersModel from '~/src/api/common/models/counters.js'
import Boom from '@hapi/boom'
import { v4 as uuidv4 } from 'uuid'

// Mock dependencies
vi.mock('~/src/api/common/models/invoices.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn()
  }
}))
vi.mock('~/src/api/common/models/counters.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn()
  }
}))
vi.mock('uuid')
vi.mock('@hapi/boom')

describe('createInvoice', () => {
  const mockUuid = '123e4567-e89b-12d3-a456-426614174000'
  const mockAgreementId = 'SFI123456789'

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock uuid generation
    uuidv4.mockReturnValue(mockUuid)

    // Default mock for invoicesModel.find
    invoicesModel.find.mockResolvedValue([{}, {}, {}]) // 3 existing invoices

    // Setup Boom mocks
    Boom.internal = vi.fn((error) => {
      const boomError = new Error(error.message || 'Internal server error')
      boomError.isBoom = true
      return boomError
    })
    Boom.notFound = vi.fn((message) => {
      const boomError = new Error(message)
      boomError.isBoom = true
      return boomError
    })
  })

  it('should create a new invoice with correct data', async () => {
    // Arrange
    const mockCounter = {
      seq: 3
    }

    const mockInvoice = {
      agreementNumber: mockAgreementId,
      invoiceNumber: 'FRPS3',
      correlationId: mockUuid
    }

    countersModel.findOneAndUpdate.mockResolvedValue(mockCounter)
    invoicesModel.create.mockResolvedValue(mockInvoice)

    // Act
    const result = await createInvoice(mockAgreementId, mockUuid)

    // Assert
    expect(countersModel.findOneAndUpdate).toHaveBeenCalled()
    expect(invoicesModel.create).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId,
      invoiceNumber: 'FRPS4', // Index is 3 because we mocked 3 existing invoices
      correlationId: mockUuid
    })
    expect(result).toEqual(mockInvoice)
  })

  it('should generate invoice numbers sequentially', async () => {
    // Arrange
    const mockCounter = {
      seq: 0
    }

    const mockInvoice = {
      agreementNumber: mockAgreementId,
      invoiceNumber: 'FRPS1',
      correlationId: mockUuid
    }

    invoicesModel.create.mockResolvedValue(mockInvoice)
    countersModel.findOneAndUpdate.mockResolvedValue(mockCounter)

    // Act
    const result = await createInvoice(mockAgreementId, mockUuid)

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
    Boom.internal.mockReturnValue(new Error('Database error'))

    // Act & Assert
    await expect(createInvoice(mockAgreementId, mockUuid)).rejects.toThrow(
      'Database error'
    )

    expect(Boom.internal).toHaveBeenCalledWith(mockError)
  })

  it('should throw Boom.notFound if invoicesModel.create returns falsy value', async () => {
    // Arrange
    invoicesModel.create.mockResolvedValue(null)
    const expectedMessage = `Invoice not created for Agreement ID ${mockAgreementId}`
    Boom.notFound.mockReturnValue(new Error(expectedMessage))

    // Act & Assert
    await expect(createInvoice(mockAgreementId, mockUuid)).rejects.toThrow(
      expectedMessage
    )

    expect(Boom.notFound).toHaveBeenCalledWith(expectedMessage)
  })
})
