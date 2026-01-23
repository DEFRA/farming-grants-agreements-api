import { describe, expect, it } from 'vitest'
import {
  formatPaymentDate,
  validateOptionalPaymentDate
} from './format-payment-date.js'

describe('formatPaymentDate', () => {
  it('formats YYYY-MM-DD into DD/MM/YYYY', () => {
    expect(formatPaymentDate('2026-05-05')).toBe('05/05/2026')
  })

  it('throws when input is not a string', () => {
    expect(() => formatPaymentDate(null)).toThrow(
      'Payment date must be a string'
    )
  })

  it('throws when input is not YYYY-MM-DD', () => {
    expect(() => formatPaymentDate('05/05/2026')).toThrow(
      'Payment date must be in YYYY-MM-DD format'
    )
  })
})

describe('validateOptionalPaymentDate', () => {
  it('allows blank strings', () => {
    expect(() => validateOptionalPaymentDate('', 'dueDate')).not.toThrow()
  })

  it('accepts valid DD/MM/YYYY dates', () => {
    expect(() =>
      validateOptionalPaymentDate('09/11/2022', 'dueDate')
    ).not.toThrow()
  })

  it('throws when value is not a string', () => {
    expect(() => validateOptionalPaymentDate(null, 'dueDate')).toThrow(
      'dueDate must be a string'
    )
  })

  it('throws when value is not DD/MM/YYYY', () => {
    expect(() => validateOptionalPaymentDate('2022-11-09', 'dueDate')).toThrow(
      'dueDate must be in DD/MM/YYYY format'
    )
  })
})
