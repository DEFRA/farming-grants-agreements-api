import { beforeEach, describe, expect, it, vi } from 'vitest'

import { calculateFpttPayments } from './fptt-land-grants.js'
import { fpttBuildAcceptedPayment } from './fptt-accept-offer.js'

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'generated-correlation-id')
}))

vi.mock('./fptt-land-grants.js', () => ({
  calculateFpttPayments: vi.fn()
}))

describe('fpttBuildAcceptedPayment', () => {
  const logger = { info: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('propagates Land Grants payment calculation failures', async () => {
    calculateFpttPayments.mockRejectedValue(
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
