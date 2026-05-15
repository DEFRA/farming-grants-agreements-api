import { beforeEach, describe, expect, it, vi } from 'vitest'

import { calculateWmpPaymentDates } from '#~/api/adapter/land-grants-adapter.js'
import { wmpBuildAcceptedPayment } from './wmp-accept-offer.js'

vi.mock('#~/api/adapter/land-grants-adapter.js', () => ({
  calculateWmpPaymentDates: vi.fn()
}))

describe('wmpBuildAcceptedPayment', () => {
  const logger = { info: vi.fn() }
  const agreementData = {
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
    calculateWmpPaymentDates.mockResolvedValue({
      agreementStartDate: '2025-09-01',
      agreementEndDate: '2035-08-31'
    })
  })

  it('returns the existing WMP payment with Land Grants agreement dates', async () => {
    const payment = await wmpBuildAcceptedPayment(agreementData, logger)

    expect(calculateWmpPaymentDates).toHaveBeenCalledWith(
      {
        parcelIds: ['SD6346-3387'],
        oldWoodlandAreaHa: 0.4,
        newWoodlandAreaHa: 0
      },
      logger
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
    calculateWmpPaymentDates.mockRejectedValue(
      new Error('Land Grants unavailable')
    )

    await expect(
      wmpBuildAcceptedPayment(agreementData, logger)
    ).rejects.toThrow('Land Grants unavailable')
  })
})
