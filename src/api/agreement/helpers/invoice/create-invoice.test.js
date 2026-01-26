import { vi } from 'vitest'
import {
  createInvoice,
  formatClaimId,
  getOrCreateClaimId
} from './create-invoice.js'
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
    find: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn()
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

describe('getOrCreateClaimId', () => {
  const mockAgreementId = 'FPTT123456789'

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup Boom mocks
    Boom.internal = vi.fn((message) => {
      const boomError = new Error(message)
      boomError.isBoom = true
      return boomError
    })
  })

  it('should generate a new claimId for version 1', async () => {
    // Arrange
    const mockCounter = { seq: 1 }
    countersModel.findOneAndUpdate.mockResolvedValue(mockCounter)

    // Act
    const result = await getOrCreateClaimId(mockAgreementId, 1)

    // Assert
    expect(countersModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'claimIds' },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    )
    expect(result).toBe('R00000001')
  })

  it('should return existing claimId for version > 1', async () => {
    // Arrange
    const existingClaimId = 'R00000005'
    const mockLean = vi.fn().mockResolvedValue({ claimId: existingClaimId })
    const mockSort = vi.fn(() => ({ lean: mockLean }))
    invoicesModel.findOne.mockReturnValue({ sort: mockSort })

    // Act
    const result = await getOrCreateClaimId(mockAgreementId, 2)

    // Assert
    expect(invoicesModel.findOne).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId
    })
    expect(mockSort).toHaveBeenCalledWith({ createdAt: 1 })
    expect(result).toBe(existingClaimId)
    expect(countersModel.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('should generate new claimId if no existing invoice found for version > 1', async () => {
    // Arrange
    const mockLean = vi.fn().mockResolvedValue(null)
    const mockSort = vi.fn(() => ({ lean: mockLean }))
    invoicesModel.findOne.mockReturnValue({ sort: mockSort })

    const mockCounter = { seq: 10 }
    countersModel.findOneAndUpdate.mockResolvedValue(mockCounter)

    // Act
    const result = await getOrCreateClaimId(mockAgreementId, 2)

    // Assert
    expect(invoicesModel.findOne).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId
    })
    expect(countersModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'claimIds' },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    )
    expect(result).toBe('R00000010')
  })

  it('should generate new claimId if existing invoice has no claimId for version > 1', async () => {
    // Arrange
    const mockLean = vi.fn().mockResolvedValue({ claimId: null })
    const mockSort = vi.fn(() => ({ lean: mockLean }))
    invoicesModel.findOne.mockReturnValue({ sort: mockSort })

    const mockCounter = { seq: 15 }
    countersModel.findOneAndUpdate.mockResolvedValue(mockCounter)

    // Act
    const result = await getOrCreateClaimId(mockAgreementId, 3)

    // Assert
    expect(countersModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'claimIds' },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    )
    expect(result).toBe('R00000015')
  })
})

describe('createInvoice', () => {
  const mockCorrelationId = '123e4567-e89b-12d3-a456-426614174000'
  const mockAgreementId = 'FPTT123456789'

  const createMockAgreementData = (version = 1, dueDate = '2024-03-15') => ({
    correlationId: mockCorrelationId,
    version,
    dueDate
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

  it('should create a new invoice with correct data and generated claimId for version 1', async () => {
    // Arrange
    const mockClaimIdCounter = { seq: 1 }
    const mockAgreementData = createMockAgreementData(1, '2024-03-15') // Q1

    const mockInvoice = {
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000001_1_Q1',
      correlationId: mockCorrelationId,
      claimId: 'R00000001'
    }

    countersModel.findOneAndUpdate.mockResolvedValue(mockClaimIdCounter)
    invoicesModel.create.mockResolvedValue(mockInvoice)

    // Act
    const result = await createInvoice(mockAgreementId, mockAgreementData)

    // Assert
    expect(countersModel.findOneAndUpdate).toHaveBeenCalledTimes(1)
    expect(countersModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'claimIds' },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    )
    expect(invoicesModel.create).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000001_1_Q1',
      correlationId: mockCorrelationId,
      claimId: 'R00000001'
    })
    expect(result).toEqual(mockInvoice)
  })

  it('should create invoice with existing claimId for version > 1', async () => {
    // Arrange
    const existingClaimId = 'R00000003'
    const mockAgreementData = createMockAgreementData(2, '2024-06-15') // Q2

    const mockInvoice = {
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000003_2_Q2',
      correlationId: mockCorrelationId,
      claimId: existingClaimId
    }

    const mockLean = vi.fn().mockResolvedValue({ claimId: existingClaimId })
    const mockSort = vi.fn(() => ({ lean: mockLean }))
    invoicesModel.findOne.mockReturnValue({ sort: mockSort })
    invoicesModel.create.mockResolvedValue(mockInvoice)

    // Act
    const result = await createInvoice(mockAgreementId, mockAgreementData)

    // Assert
    expect(invoicesModel.findOne).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId
    })
    expect(invoicesModel.create).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000003_2_Q2',
      correlationId: mockCorrelationId,
      claimId: existingClaimId
    })
    expect(result).toEqual(mockInvoice)
  })

  it('should generate invoice numbers sequentially', async () => {
    // Arrange
    const mockClaimIdCounter = { seq: 1 }
    const mockAgreementData = createMockAgreementData(1, '2024-09-15') // Q3

    const mockInvoice = {
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000001_1_Q3',
      correlationId: mockCorrelationId,
      claimId: 'R00000001'
    }

    countersModel.findOneAndUpdate.mockResolvedValue(mockClaimIdCounter)
    invoicesModel.create.mockResolvedValue(mockInvoice)

    // Act
    const result = await createInvoice(mockAgreementId, mockAgreementData)

    // Assert
    expect(invoicesModel.create).toHaveBeenCalledWith({
      agreementNumber: mockAgreementId,
      invoiceNumber: 'R00000001_1_Q3',
      correlationId: mockCorrelationId,
      claimId: 'R00000001'
    })
    expect(result).toEqual(mockInvoice)
  })

  it('should throw Boom.internal if invoicesModel.create throws an error', async () => {
    // Arrange
    const mockError = new Error('Database error')
    const mockClaimIdCounter = { seq: 1 }
    const mockAgreementData = createMockAgreementData(1)

    countersModel.findOneAndUpdate.mockResolvedValue(mockClaimIdCounter)
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
    const mockClaimIdCounter = { seq: 1 }
    const mockAgreementData = createMockAgreementData(1)

    countersModel.findOneAndUpdate.mockResolvedValue(mockClaimIdCounter)
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
