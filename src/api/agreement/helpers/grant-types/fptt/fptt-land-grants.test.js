import { beforeEach, describe, expect, it, vi } from 'vitest'

import { config } from '#~/config/index.js'
import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'
import { calculateFpttPayments } from './fptt-land-grants.js'

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn()
  }
}))

vi.mock('#~/api/adapter/land-grants-adapter.js', () => ({
  calculatePaymentsBasedOnParcelsWithActions: vi.fn()
}))

describe('calculateFpttPayments', () => {
  const parcels = [{ parcelId: '1', actions: [] }]
  const logger = { info: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the legacy calculation URI while FPTT has the default configured', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'landGrants.calculationUri') {
        return '/legacy/fptt/calculate'
      }
      if (key === 'landGrants.calculationUris.fptt') {
        return '/api/v2/payments/calculate'
      }
      throw new Error(`Unexpected config key ${key}`)
    })

    await calculateFpttPayments(parcels, logger)

    expect(calculatePaymentsBasedOnParcelsWithActions).toHaveBeenCalledWith(
      parcels,
      logger,
      { calculationUri: '/legacy/fptt/calculate' }
    )
  })

  it('uses the FPTT-specific calculation URI when configured', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'landGrants.calculationUri') {
        return '/legacy/fptt/calculate'
      }
      if (key === 'landGrants.calculationUris.fptt') {
        return '/specific/fptt/calculate'
      }
      throw new Error(`Unexpected config key ${key}`)
    })

    await calculateFpttPayments(parcels, logger)

    expect(calculatePaymentsBasedOnParcelsWithActions).toHaveBeenCalledWith(
      parcels,
      logger,
      { calculationUri: '/specific/fptt/calculate' }
    )
  })
})
