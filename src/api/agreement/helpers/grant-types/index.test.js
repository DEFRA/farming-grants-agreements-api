import { describe, expect, it } from 'vitest'

import { getGrantTypeByCode } from './index.js'

describe('getGrantTypeByCode', () => {
  it('returns the WMP grant type for woodland', () => {
    const grantType = getGrantTypeByCode('woodland')

    expect(grantType.scheme).toBe('wmp')
    expect(grantType.createOffer).toEqual(expect.any(Function))
    expect(grantType.buildAgreementWithPayment).toEqual(expect.any(Function))
    expect(grantType.buildPaymentForAcceptance).toEqual(expect.any(Function))
  })

  it('returns the FPTT grant type for frps-private-beta', () => {
    const grantType = getGrantTypeByCode('frps-private-beta')

    expect(grantType.scheme).toBe('fptt')
    expect(grantType.createOffer).toEqual(expect.any(Function))
    expect(grantType.buildAgreementWithPayment).toEqual(expect.any(Function))
    expect(grantType.buildPaymentForAcceptance).toEqual(expect.any(Function))
  })

  it('normalises code case and whitespace', () => {
    expect(getGrantTypeByCode(' WOODLAND ').scheme).toBe('wmp')
  })

  it('throws bad request when code is missing', () => {
    expect(() => getGrantTypeByCode()).toThrow('Agreement code is required')
  })

  it('throws bad request for unknown code', () => {
    expect(() => getGrantTypeByCode('something-else')).toThrow(
      'Unknown agreement code: something-else'
    )
  })
})
