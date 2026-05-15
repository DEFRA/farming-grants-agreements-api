import { beforeEach, describe, expect, it, vi } from 'vitest'

import { config } from '#~/config/index.js'
import { calculateWmpPaymentDates } from '#~/api/adapter/land-grants-adapter.js'
import { calculateWmpAgreementDates } from './wmp-land-grants.js'

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn()
  }
}))

vi.mock('#~/api/adapter/land-grants-adapter.js', () => ({
  calculateWmpPaymentDates: vi.fn()
}))

describe('calculateWmpAgreementDates', () => {
  const requestData = {
    parcelIds: ['SD6346-3387'],
    oldWoodlandAreaHa: 0.4,
    newWoodlandAreaHa: 0
  }
  const logger = { info: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    config.get.mockImplementation((key) => {
      if (key === 'landGrants.calculationUris.wmp') {
        return '/api/v1/wmp/payments/calculate'
      }
      throw new Error(`Unexpected config key ${key}`)
    })
  })

  it('uses the WMP calculation URI', async () => {
    await calculateWmpAgreementDates(requestData, logger)

    expect(calculateWmpPaymentDates).toHaveBeenCalledWith(requestData, logger, {
      calculationUri: '/api/v1/wmp/payments/calculate'
    })
  })
})
