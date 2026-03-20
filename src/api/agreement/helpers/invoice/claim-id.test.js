import { getClaimId } from './claim-id.js'
import { formatClaimId } from './generate-original-invoice-number.js'
import invoicesModel from '#~/api/common/models/invoices.js'
import countersModel from '#~/api/common/models/counters.js'

// Mock dependencies
vi.mock('#~/api/common/models/invoices.js', () => ({
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
vi.mock('#~/api/common/models/counters.js', () => ({
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
