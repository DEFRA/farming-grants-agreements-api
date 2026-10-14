import { describe, expect, it } from 'vitest'

import { getGrantTypeByCode } from './index.js'

describe('getGrantTypeByCode', () => {
  it('returns the FPTT grant type for frps-private-beta', () => {
    const grantType = getGrantTypeByCode('frps-private-beta')

    expect(grantType.scheme).toBe('fptt')
    expect(grantType.createOffer).toEqual(expect.any(Function))
    expect(grantType.buildAgreementWithPayment).toEqual(expect.any(Function))
    expect(grantType.buildPaymentForAcceptance).toEqual(expect.any(Function))
  })

  it('normalises code case and whitespace', () => {
    expect(getGrantTypeByCode(' FRPS-PRIVATE-BETA ').scheme).toBe('fptt')
  })

  it('throws bad request when code is missing', () => {
    expect(() => getGrantTypeByCode()).toThrow('Agreement code is required')
  })

  it.each(['woodland', 'something-else'])(
    'throws bad request for unsupported code %s',
    (code) => {
      expect(() => getGrantTypeByCode(code)).toThrow(
        `Unknown agreement code: ${code}`
      )
    }
  )
})
