import { addYears } from 'date-fns'
import { calculateRetentionPeriod } from './retention-period.js'

describe('calculateRetentionPeriod', () => {
  test('should return 10 years for 1 year from now', () => {
    const endDate = addYears(new Date(), 1)
    expect(calculateRetentionPeriod(endDate)).toBe(10)
  })

  test('should return 10 years for 2 years from now', () => {
    const endDate = addYears(new Date(), 2)
    expect(calculateRetentionPeriod(endDate)).toBe(10)
  })

  test('should return 10 years for 3 years from now', () => {
    const endDate = addYears(new Date(), 3)
    expect(calculateRetentionPeriod(endDate)).toBe(10)
  })

  test('should return 15 years for 4 years from now', () => {
    const endDate = addYears(new Date(), 4)
    expect(calculateRetentionPeriod(endDate)).toBe(15)
  })

  test('should return 15 years for 5 years from now', () => {
    const endDate = addYears(new Date(), 5)
    expect(calculateRetentionPeriod(endDate)).toBe(15)
  })

  test('should return 15 years for 8 years from now', () => {
    const endDate = addYears(new Date(), 8)
    expect(calculateRetentionPeriod(endDate)).toBe(15)
  })

  test('should return 20 years for 9 years from now', () => {
    const endDate = addYears(new Date(), 9)
    expect(calculateRetentionPeriod(endDate)).toBe(20)
  })

  test('should return 20 years for 10 years from now', () => {
    const endDate = addYears(new Date(), 10)
    expect(calculateRetentionPeriod(endDate)).toBe(20)
  })

  test('should return 20 years for 15 years from now', () => {
    const endDate = addYears(new Date(), 15)
    expect(calculateRetentionPeriod(endDate)).toBe(20)
  })

  test('should return 20 years for 20 years from now', () => {
    const endDate = addYears(new Date(), 20)
    expect(calculateRetentionPeriod(endDate)).toBe(20)
  })

  test('should handle Date objects as input', () => {
    const endDate = addYears(new Date(), 3)
    expect(calculateRetentionPeriod(endDate)).toBe(10)
  })

  test('should handle string dates as input', () => {
    const endDate = addYears(new Date(), 3).toISOString()
    expect(calculateRetentionPeriod(endDate)).toBe(10)
  })
})
