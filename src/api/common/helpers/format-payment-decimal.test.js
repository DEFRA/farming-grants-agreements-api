import { describe, expect, it } from 'vitest'
import { formatPaymentDecimal } from './format-payment-decimal.js'

describe('formatPaymentDecimal', () => {
  it('converts pence to a decimal currency value', () => {
    expect(formatPaymentDecimal(1086)).toBe(10.86)
  })

  it('keeps zero values unchanged', () => {
    expect(formatPaymentDecimal(0)).toBe(0)
  })

  it('handles the maximum supported value', () => {
    expect(formatPaymentDecimal(99999999999999)).toBe(999999999999.99)
  })

  it('throws for non-numeric inputs', () => {
    expect(() => formatPaymentDecimal(Number.NaN)).toThrow(
      'Payment value must be a finite number'
    )
  })

  it('throws for non-integer values', () => {
    expect(() => formatPaymentDecimal(10.5)).toThrow(
      'Payment value must be an integer number of pence'
    )
  })

  it('throws for values outside the allowed range', () => {
    expect(() => formatPaymentDecimal(-1)).toThrow(
      'Payment value must be between 0 and 99999999999999'
    )
  })
})
