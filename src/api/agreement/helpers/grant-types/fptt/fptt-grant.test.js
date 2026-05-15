import { describe, expect, it, vi } from 'vitest'

import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'
import { fptt } from './fptt-grant.js'

vi.mock('#~/api/adapter/land-grants-adapter.js', () => ({
  calculatePaymentsBasedOnParcelsWithActions: vi.fn()
}))

describe('fptt grant type', () => {
  it('prepares agreement data for GET without mutating the persisted agreement', async () => {
    const calculatedPayment = { agreementTotalPence: 1000, payments: [] }
    const agreementData = {
      code: 'frps-private-beta',
      status: 'offered',
      application: { parcel: [{ parcelId: '1', actions: [] }] }
    }
    const logger = { info: vi.fn() }

    calculatePaymentsBasedOnParcelsWithActions.mockResolvedValue(
      calculatedPayment
    )

    const result = await fptt.buildAgreementWithPayment(agreementData, logger)

    expect(result).toEqual({ ...agreementData, payment: calculatedPayment })
    expect(result).not.toBe(agreementData)
    expect(agreementData).not.toHaveProperty('payment')
  })
})
