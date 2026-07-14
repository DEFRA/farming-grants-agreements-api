import { beforeEach, describe, expect, it, vi } from 'vitest'

import { calculateWmpAgreementDates } from './wmp-land-grants.js'
import { wmpBuildAcceptedPayment } from './wmp-accept-offer.js'

vi.mock('./wmp-land-grants.js', () => ({
  calculateWmpAgreementDates: vi.fn()
}))

describe('wmpBuildAcceptedPayment', () => {
  const logger = { info: vi.fn() }
  const agreementData = {
    correlationId: 'correlation-1234',
    schemeData: {
      oldWoodlandAreaHa: 0.4,
      newWoodlandAreaHa: 0
    },
    application: {
      parcel: [{ parcelId: 'SD6346-3387' }]
    },
    payment: {
      agreementStartDate: null,
      agreementEndDate: null,
      frequency: 'OneOff',
      agreementTotalPence: 1000,
      annualTotalPence: 1000,
      parcelItems: {},
      agreementLevelItems: {},
      payments: []
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    calculateWmpAgreementDates.mockResolvedValue({
      agreementStartDate: '2025-09-01',
      agreementEndDate: '2035-08-31'
    })
  })

  it('returns the existing WMP payment with Land Grants agreement dates', async () => {
    const payment = await wmpBuildAcceptedPayment(agreementData, logger)

    expect(calculateWmpAgreementDates).toHaveBeenCalledWith(
      {
        parcelIds: ['SD6346-3387'],
        oldWoodlandAreaHa: 0.4,
        newWoodlandAreaHa: 0
      },
      logger,
      'correlation-1234'
    )
    expect(payment).toEqual({
      ...agreementData.payment,
      agreementStartDate: '2025-09-01',
      agreementEndDate: '2035-08-31'
    })
  })

  it('throws when there is no existing WMP payment to update', async () => {
    await expect(
      wmpBuildAcceptedPayment({ ...agreementData, payment: undefined }, logger)
    ).rejects.toThrow('Failed to calculate WMP agreement dates')
  })

  it('propagates Land Grants calculation failures', async () => {
    calculateWmpAgreementDates.mockRejectedValue(
      new Error('Land Grants unavailable')
    )

    await expect(
      wmpBuildAcceptedPayment(agreementData, logger)
    ).rejects.toThrow('Land Grants unavailable')
  })
})
