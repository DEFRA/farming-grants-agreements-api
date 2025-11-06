import { addYears } from 'date-fns'
import { getRetentionPrefix } from './retention-period.js'

describe('getRetentionPrefix', () => {
  test('should return base prefix for 1 year from now', () => {
    const endDate = addYears(new Date(), 1)
    expect(getRetentionPrefix(endDate)).toBe('base')
  })

  test('should return base prefix for 2 years from now', () => {
    const endDate = addYears(new Date(), 2)
    expect(getRetentionPrefix(endDate)).toBe('base')
  })

  test('should return base prefix for 3 years from now', () => {
    const endDate = addYears(new Date(), 3)
    expect(getRetentionPrefix(endDate)).toBe('base')
  })

  test('should return extended prefix for 4 years from now', () => {
    const endDate = addYears(new Date(), 4)
    expect(getRetentionPrefix(endDate)).toBe('extended')
  })

  test('should return extended prefix for 5 years from now', () => {
    const endDate = addYears(new Date(), 5)
    expect(getRetentionPrefix(endDate)).toBe('extended')
  })

  test('should return extended prefix for 8 years from now', () => {
    const endDate = addYears(new Date(), 8)
    expect(getRetentionPrefix(endDate)).toBe('extended')
  })

  test('should return maximum prefix for 9 years from now', () => {
    const endDate = addYears(new Date(), 9)
    expect(getRetentionPrefix(endDate)).toBe('maximum')
  })

  test('should return maximum prefix for 10 years from now', () => {
    const endDate = addYears(new Date(), 10)
    expect(getRetentionPrefix(endDate)).toBe('maximum')
  })

  test('should return maximum prefix for 15 years from now', () => {
    const endDate = addYears(new Date(), 15)
    expect(getRetentionPrefix(endDate)).toBe('maximum')
  })

  test('should return maximum prefix for 20 years from now', () => {
    const endDate = addYears(new Date(), 20)
    expect(getRetentionPrefix(endDate)).toBe('maximum')
  })

  test('should handle Date objects as input', () => {
    const endDate = addYears(new Date(), 3)
    expect(getRetentionPrefix(endDate)).toBe('base')
  })

  test('should handle string dates as input', () => {
    const endDate = addYears(new Date(), 3).toISOString()
    expect(getRetentionPrefix(endDate)).toBe('base')
  })
})
