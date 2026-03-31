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
  it('returns invoice number in R00000001-V001Q1 format for Q1 date', () => {
    expect(generateInvoiceNumber('R00000001', 1, '2024-01-15')).toBe(
      'R00000001-V001Q1'
    )
  })

  it('returns invoice number in R00000001-V001Q2 format for Q2 date', () => {
    expect(generateInvoiceNumber('R00000001', 1, '2024-05-01')).toBe(
      'R00000001-V001Q2'
    )
  })

  it('returns invoice number in R00000001-V001Q3 format for Q3 date', () => {
    expect(generateInvoiceNumber('R00000001', 1, '2024-08-20')).toBe(
      'R00000001-V001Q3'
    )
  })

  it('returns invoice number in R00000001-V001Q4 format for Q4 date', () => {
    expect(generateInvoiceNumber('R00000001', 1, '2024-11-30')).toBe(
      'R00000001-V001Q4'
    )
  })

  it('pads the payment request number to 3 digits', () => {
    expect(generateInvoiceNumber('R00000001', 10, '2024-05-01')).toBe(
      'R00000001-V010Q2'
    )
  })
})
