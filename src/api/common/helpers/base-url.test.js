import { getBaseUrl } from './base-url.js'

describe('getBaseUrl', () => {
  it('should return the value of x-base-url header if present', () => {
    const mockRequest = { headers: { 'x-base-url': 'https://example.com/api' } }
    expect(getBaseUrl(mockRequest)).toBe('https://example.com/api')
  })

  it('should return "/" if x-base-url header is not present', () => {
    const mockRequest = { headers: {} }
    expect(getBaseUrl(mockRequest)).toBe('/')
  })

  it('should return "/" if headers is undefined', () => {
    const mockRequest = {}
    // Defensive: if implementation changes to handle undefined headers
    expect(getBaseUrl(mockRequest)).toBe('/')
  })
})
