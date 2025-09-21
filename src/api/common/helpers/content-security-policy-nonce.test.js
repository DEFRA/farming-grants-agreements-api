import { getContentSecurityPolicyNonce } from './content-security-policy-nonce.js'

describe('getContentSecurityPolicyNonce', () => {
  it('returns the nonce value when x-csp-nonce header is present', () => {
    const request = {
      headers: {
        'x-csp-nonce': 'abc123'
      }
    }

    expect(getContentSecurityPolicyNonce(request)).toBe('abc123')
  })

  it('returns default when x-csp-nonce header is missing', () => {
    const request = {
      headers: {
        'content-type': 'application/json'
      }
    }

    expect(getContentSecurityPolicyNonce(request)).toBe('')
  })

  it('returns default when headers object is missing', () => {
    const request = {}
    expect(getContentSecurityPolicyNonce(request)).toBe('')
  })

  it('returns default when no request is passed', () => {
    expect(getContentSecurityPolicyNonce()).toBe('')
  })

  it('is case sensitive and does not match capitalized header names', () => {
    const request = {
      headers: {
        'X-CSP-Nonce': 'abc123'
      }
    }

    expect(getContentSecurityPolicyNonce(request)).toBe('')
  })
})
