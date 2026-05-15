import { describe, expect, it, vi } from 'vitest'

import { wmp } from './wmp-grant.js'
import { wmpCreateOffer } from './wmp-create-offer.js'
import { wmpBuildAcceptedPayment } from './wmp-accept-offer.js'

vi.mock('./wmp-create-offer.js', () => ({
  wmpCreateOffer: vi.fn()
}))

vi.mock('./wmp-accept-offer.js', () => ({
  wmpBuildAcceptedPayment: vi.fn()
}))

describe('wmp grant type', () => {
  it('exposes the WMP scheme and grant lifecycle handlers', () => {
    expect(wmp.scheme).toBe('wmp')
    expect(wmp.createOffer).toBe(wmpCreateOffer)
    expect(wmp.buildPaymentForAcceptance).toBe(wmpBuildAcceptedPayment)
  })

  it('returns WMP agreement data unchanged for GET', () => {
    const agreementData = {
      code: 'woodland',
      status: 'offered',
      payment: {
        agreementStartDate: null,
        agreementEndDate: null
      }
    }

    expect(wmp.buildAgreementWithPayment(agreementData)).toBe(agreementData)
  })
})
