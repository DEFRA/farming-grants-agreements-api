import { addYears } from 'date-fns'
import { getRetentionPrefix } from './retention-period.js'

describe('getRetentionPrefix', () => {
  test('should return base prefix for 1 year from now', () => {
    const startDate = new Date()
    const endDate = addYears(startDate, 1)
    expect(getRetentionPrefix(startDate, endDate)).toBe('base')
  })

  test('should return base prefix for 2 years from now', () => {
    const startDate = new Date()
    const endDate = addYears(startDate, 2)
    expect(getRetentionPrefix(startDate, endDate)).toBe('base')
  })

  test('should return base prefix for 3 years from now', () => {
    const startDate = new Date()
    const endDate = addYears(startDate, 3)
    expect(getRetentionPrefix(startDate, endDate)).toBe('base')
  })

  test('should return extended prefix for 4 years from now', () => {
    const startDate = new Date()
    const endDate = addYears(startDate, 4)
    expect(getRetentionPrefix(startDate, endDate)).toBe('extended')
  })

  test('should return extended prefix for 5 years from now', () => {
    const startDate = new Date()
    const endDate = addYears(startDate, 5)
    expect(getRetentionPrefix(startDate, endDate)).toBe('extended')
  })

  test('should return extended prefix for 8 years from now', () => {
    const startDate = new Date()
    const endDate = addYears(startDate, 8)
    expect(getRetentionPrefix(startDate, endDate)).toBe('extended')
  })

  test('should return maximum prefix for 9 years from now', () => {
    const startDate = new Date()
    const endDate = addYears(startDate, 9)
    expect(getRetentionPrefix(startDate, endDate)).toBe('maximum')
  })

  test('should return maximum prefix for 10 years from now', () => {
    const startDate = new Date()
    const endDate = addYears(startDate, 10)
    expect(getRetentionPrefix(startDate, endDate)).toBe('maximum')
  })

  test('should return maximum prefix for 15 years from now', () => {
    const startDate = new Date()
    const endDate = addYears(startDate, 15)
    expect(getRetentionPrefix(startDate, endDate)).toBe('maximum')
  })

  test('should return maximum prefix for 20 years from now', () => {
    const startDate = new Date()
    const endDate = addYears(startDate, 20)
    expect(getRetentionPrefix(startDate, endDate)).toBe('maximum')
  })

  test('should handle Date objects as input', () => {
    const startDate = new Date()
    const endDate = addYears(startDate, 3)
    expect(getRetentionPrefix(startDate, endDate)).toBe('base')
  })

  test('should handle string dates as input', () => {
    const startDate = new Date().toISOString()
    const endDate = addYears(new Date(), 3).toISOString()
    expect(getRetentionPrefix(startDate, endDate)).toBe('base')
  })
})
