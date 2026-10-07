import { vi, describe, it, beforeEach, expect } from 'vitest'

import { createOffer } from './create-offer.js'
import { fpttCreateOffer } from './grant-types/fptt/fptt-create-offer.js'

vi.mock('./grant-types/fptt/fptt-create-offer.js', () => ({
  fpttCreateOffer: vi.fn().mockResolvedValue('fptt-result')
}))

describe('createOffer dispatcher', () => {
  const notificationMessageId = 'msg-1'
  const logger = { info: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes code "frps-private-beta" to fpttCreateOffer', async () => {
    const data = { code: 'frps-private-beta' }
    const result = await createOffer(notificationMessageId, data, logger)

    expect(fpttCreateOffer).toHaveBeenCalledWith(
      notificationMessageId,
      data,
      logger
    )
    expect(result).toBe('fptt-result')
  })

  it('is case-insensitive on the code', async () => {
    await createOffer(
      notificationMessageId,
      { code: 'FRPS-PRIVATE-BETA' },
      logger
    )
    expect(fpttCreateOffer).toHaveBeenCalledTimes(1)
  })

  it.each(['woodland', 'something-else'])(
    'rejects unsupported code %s',
    (code) => {
      expect(() =>
        createOffer(notificationMessageId, { code }, logger)
      ).toThrow(`Unknown agreement code: ${code}`)

      expect(fpttCreateOffer).not.toHaveBeenCalled()
    }
  )

  it('rejects when code is missing', () => {
    expect(() => createOffer(notificationMessageId, {}, logger)).toThrow(
      'Agreement code is required'
    )

    expect(fpttCreateOffer).not.toHaveBeenCalled()
  })

  it('rejects when offer data is missing', () => {
    expect(() => createOffer(notificationMessageId, undefined, logger)).toThrow(
      'Offer data is required'
    )

    expect(fpttCreateOffer).not.toHaveBeenCalled()
  })

  it('rejects when code is not a string', () => {
    expect(() =>
      createOffer(notificationMessageId, { code: 123 }, logger)
    ).toThrow('Agreement code is required')

    expect(fpttCreateOffer).not.toHaveBeenCalled()
  })
})
