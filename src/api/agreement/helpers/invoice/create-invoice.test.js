import { vi } from 'vitest'
import { createInvoice, getClaimId } from './create-invoice.js'
import { formatClaimId } from './generate-original-invoice-number.js'
import invoicesModel from '~/src/api/common/models/invoices.js'
import countersModel from '~/src/api/common/models/counters.js'
import Boom from '@hapi/boom'

// Mock dependencies
vi.mock('~/src/api/common/models/invoices.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(() => ({
      sort: vi.fn(() => ({
        lean: vi.fn()
      }))
    })),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn()
  }
}))
vi.mock('~/src/api/common/models/counters.js', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: vi.fn()
  }
}))
vi.mock('@hapi/boom')

describe('formatClaimId', () => {
  it('should format claimId with R prefix and 8 digit padding', () => {
    expect(formatClaimId(1)).toBe('R00000001')
    expect(formatClaimId(10)).toBe('R00000010')
    expect(formatClaimId(100)).toBe('R00000100')
    expect(formatClaimId(12345678)).toBe('R12345678')
  })
})

describe('getClaimId', () => {
  const mockAgreementId = 'FPTT123456789'

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup Boom mocks
    Boom.notFound = vi.fn((message) => {
      const boomError = new Error(message)
      boomError.isBoom = true
      return boomError
    })
  })

  it('should return claimId from agreementData if it exists', async () => {
    // Arrange
    const mockAgreementData = {
      claimId: 'R00000005'
    }

    // Act
    const result = await getClaimId(mockAgreementId, mockAgreementData)

    // Assert
    expect(result).toBe('R00000005')
    expect(invoicesModel.findOne).not.toHaveBeenCalled()
  })

  it('should fallback to existing invoice if claimId not in agreementData', async () => {
    // Arrange
    const existingClaimId = 'R00000010'
    const mockAgreementData = { payment: {} }
    const mockLean = vi.fn().mockResolvedValue({ claimId: existingClaimId })
    const mockSort = vi.fn(() => ({ lean: mockLean }))
    invoicesModel.findOne.mockReturnValue({ sort: mockSort })

    // Act
    const result = await getClaimId(mockAgreementId, mockAgreementData)

    // Assert
    expect(invoicesModel.findOne).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId
    })
    expect(mockSort).toHaveBeenCalledWith({ createdAt: 1 })
    expect(result).toBe(existingClaimId)
  })

  it('should generate new claimId if no claimId found anywhere', async () => {
    // Arrange
    const mockAgreementData = {}
    const mockLean = vi.fn().mockResolvedValue(null)
    const mockSort = vi.fn(() => ({ lean: mockLean }))
    invoicesModel.findOne.mockReturnValue({ sort: mockSort })

    const mockCounter = { seq: 99 }
    countersModel.findOneAndUpdate.mockResolvedValue(mockCounter)

    // Act
    const result = await getClaimId(mockAgreementId, mockAgreementData)

    // Assert
    expect(result).toBe('R00000099')
    expect(countersModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'claimIds' },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    )
  })
})

describe('createInvoice', () => {
  const mockCorrelationId = '123e4567-e89b-12d3-a456-426614174000'
  const mockAgreementId = 'FPTT123456789'

  const createMockAgreementData = (
    version = 1,
    claimId = 'R00000001',
    originalInvoiceNumber = 'R00000001-V001Q1'
  ) => ({
    correlationId: mockCorrelationId,
    version,
    claimId,
    originalInvoiceNumber,
    payment: {
      payments: [{ paymentDate: '2024-03-15' }]
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()

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

  it('should create invoice for version 1 using originalInvoiceNumber from agreementData', async () => {
    // Arrange
    const mockAgreementData = createMockAgreementData(
      1,
      'R00000001',
      'R00000001-V001Q1'
    )

    const mockInvoice = {
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000001-V001Q1',
      correlationId: mockCorrelationId,
      claimId: 'R00000001'
    }

    invoicesModel.create.mockResolvedValue(mockInvoice)

    // Act
    const result = await createInvoice(mockAgreementId, mockAgreementData)

    // Assert
    expect(invoicesModel.create).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000001-V001Q1',
      correlationId: mockCorrelationId,
      claimId: 'R00000001'
    })
    expect(result).toEqual(mockInvoice)
  })

  it('should create invoice for version > 1 with new invoiceNumber but same claimId', async () => {
    // Arrange
    const mockAgreementData = {
      correlationId: mockCorrelationId,
      version: 2,
      claimId: 'R00000001',
      originalInvoiceNumber: 'R00000001_V001_Q1',
      payment: {
        payments: [{ paymentDate: '2024-06-15' }] // Q2
      }
    }

    const mockInvoice = {
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000001-V002Q2',
      correlationId: mockCorrelationId,
      claimId: 'R00000001'
    }

    invoicesModel.create.mockResolvedValue(mockInvoice)

    // Act
    const result = await createInvoice(mockAgreementId, mockAgreementData)

    // Assert
    expect(invoicesModel.create).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000001-V002Q2',
      correlationId: mockCorrelationId,
      claimId: 'R00000001'
    })
    expect(result).toEqual(mockInvoice)
  })

  it('should generate different quarters based on payment date', async () => {
    // Arrange - Q3 (September)
    const mockAgreementData = {
      correlationId: mockCorrelationId,
      version: 2,
      claimId: 'R00000001',
      originalInvoiceNumber: 'R00000001_V001_Q1',
      payment: {
        payments: [{ paymentDate: '2024-09-15' }] // Q3
      }
    }

    const mockInvoice = {
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000001-V002Q3',
      correlationId: mockCorrelationId,
      claimId: 'R00000001'
    }

    invoicesModel.create.mockResolvedValue(mockInvoice)

    // Act
    const result = await createInvoice(mockAgreementId, mockAgreementData)

    // Assert
    expect(invoicesModel.create).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000001-V002Q3',
      correlationId: mockCorrelationId,
      claimId: 'R00000001'
    })
    expect(result).toEqual(mockInvoice)
  })

  it('should throw Boom.internal if invoicesModel.create throws an error', async () => {
    // Arrange
    const mockError = new Error('Database error')
    const mockAgreementData = createMockAgreementData(1)

    invoicesModel.create.mockRejectedValue(mockError)
    Boom.internal.mockReturnValue(new Error('Database error'))

    // Act & Assert
    await expect(
      createInvoice(mockAgreementId, mockAgreementData)
    ).rejects.toThrow('Database error')

    expect(Boom.internal).toHaveBeenCalledWith(mockError)
  })

  it('should throw Boom.notFound if invoicesModel.create returns falsy value', async () => {
    // Arrange
    const mockAgreementData = createMockAgreementData(1)

    invoicesModel.create.mockResolvedValue(null)
    const expectedMessage = `Invoice not created for Agreement ID ${mockAgreementId}`
    Boom.notFound.mockReturnValue(new Error(expectedMessage))

    // Act & Assert
    await expect(
      createInvoice(mockAgreementId, mockAgreementData)
    ).rejects.toThrow(expectedMessage)

    expect(Boom.notFound).toHaveBeenCalledWith(expectedMessage)
  })
})
