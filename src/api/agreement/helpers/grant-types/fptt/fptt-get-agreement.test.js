import { beforeEach, describe, expect, it, vi } from 'vitest'

import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'
import { fpttGetPayment } from './fptt-get-agreement.js'

vi.mock('#~/api/adapter/land-grants-adapter.js', () => ({
  calculatePaymentsBasedOnParcelsWithActions: vi.fn()
}))

describe('fpttGetPayment', () => {
  const logger = { info: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns calculated payment for offered agreements without mutating the agreement', async () => {
    const calculatedPayment = { agreementTotalPence: 1000, payments: [] }
    const agreementData = {
      status: 'offered',
      application: { parcel: [{ parcelId: '1', actions: [] }] }
    }

    calculatePaymentsBasedOnParcelsWithActions.mockResolvedValue(
      calculatedPayment
    )

    const payment = await fpttGetPayment(agreementData, logger)

    expect(payment).toBe(calculatedPayment)
    expect(agreementData).not.toHaveProperty('payment')
  })

  it('returns persisted payment when recalculation is not needed', async () => {
    const persistedPayment = { agreementTotalPence: 1000, payments: [] }
    const agreementData = {
      status: 'accepted',
      payment: persistedPayment,
      application: { parcel: [] }
    }

    const payment = await fpttGetPayment(agreementData, logger)

    expect(payment).toBe(persistedPayment)
    expect(calculatePaymentsBasedOnParcelsWithActions).not.toHaveBeenCalled()
  })
})
