import { vi, describe, it, expect, beforeEach } from 'vitest'
import countersModel from '#~/api/common/models/counters.js'
import {
  generateClaimId,
  generateInvoiceNumber,
  formatClaimId
} from '#~/api/agreement/helpers/invoice/generate-original-invoice-number.js'

vi.mock('#~/api/common/models/counters.js', () => ({
  default: {
    findOneAndUpdate: vi.fn()
  }
}))

describe('formatClaimId', () => {
  it('pads the sequence number with R prefix to 8 digits', () => {
    expect(formatClaimId(1)).toBe('R00000001')
    expect(formatClaimId(123)).toBe('R00000123')
    expect(formatClaimId(12345678)).toBe('R12345678')
  })
})

describe('generateClaimId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a formatted claim ID from the incremented counter', async () => {
    vi.mocked(countersModel.findOneAndUpdate).mockResolvedValue({ seq: 1 })

    const result = await generateClaimId()

    expect(countersModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'claimIds' },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    )
    expect(result).toBe('R00000001')
  })
})

describe('generateInvoiceNumber', () => {
  it('returns invoice number with claimId and padded request number', () => {
    expect(generateInvoiceNumber('R00000001', 1)).toBe('R00000001-V001QX')
  })

  it('pads the payment request number to 3 digits with QX', () => {
    expect(generateInvoiceNumber('R00000001', 10)).toBe('R00000001-V010QX')
  })
})
