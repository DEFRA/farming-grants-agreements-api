import { beforeEach, describe, expect, it, vi } from 'vitest'

import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'
import { fpttBuildAcceptedPayment } from './fptt-accept-offer.js'

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'generated-correlation-id')
}))

vi.mock('#~/api/adapter/land-grants-adapter.js', () => ({
  calculatePaymentsBasedOnParcelsWithActions: vi.fn()
}))

describe('fpttBuildAcceptedPayment', () => {
  const logger = { info: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('propagates Land Grants payment calculation failures', async () => {
    calculatePaymentsBasedOnParcelsWithActions.mockRejectedValue(
      new Error(
        'FPTT payment calculation must include agreementStartDate and agreementEndDate'
      )
    )

    await expect(
      fpttBuildAcceptedPayment(
        {
          application: { parcel: [{ parcelId: '1', actions: [] }] },
          payment: { payments: [] }
        },
        logger
      )
    ).rejects.toThrow(
      'FPTT payment calculation must include agreementStartDate and agreementEndDate'
    )
  })
})
