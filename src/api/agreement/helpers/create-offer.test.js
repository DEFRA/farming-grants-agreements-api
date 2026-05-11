import { vi, describe, it, beforeEach, expect } from 'vitest'

import { createOffer } from './create-offer.js'
import { wmpCreateOffer } from './grant-types/wmp/wmp-create-offer.js'
import { fpttCreateOffer } from './grant-types/fptt/fptt-create-offer.js'

vi.mock('./grant-types/wmp/wmp-create-offer.js', () => ({
  wmpCreateOffer: vi.fn().mockResolvedValue('wmp-result')
}))
vi.mock('./grant-types/fptt/fptt-create-offer.js', () => ({
  fpttCreateOffer: vi.fn().mockResolvedValue('fptt-result')
}))

describe('createOffer dispatcher', () => {
  const notificationMessageId = 'msg-1'
  const logger = { info: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes code "woodland" to wmpCreateOffer', async () => {
    const data = { code: 'woodland' }
    const result = await createOffer(notificationMessageId, data, logger)

    expect(wmpCreateOffer).toHaveBeenCalledWith(
      notificationMessageId,
      data,
      logger
    )
    expect(fpttCreateOffer).not.toHaveBeenCalled()
    expect(result).toBe('wmp-result')
  })

  it('routes code "frps-private-beta" to fpttCreateOffer', async () => {
    const data = { code: 'frps-private-beta' }
    const result = await createOffer(notificationMessageId, data, logger)

    expect(fpttCreateOffer).toHaveBeenCalledWith(
      notificationMessageId,
      data,
      logger
    )
    expect(wmpCreateOffer).not.toHaveBeenCalled()
    expect(result).toBe('fptt-result')
  })

  it('is case-insensitive on the code', async () => {
    await createOffer(notificationMessageId, { code: 'WOODLAND' }, logger)
    expect(wmpCreateOffer).toHaveBeenCalledTimes(1)
  })

  it('rejects an unknown code', () => {
    const data = { code: 'something-else' }
    expect(() => createOffer(notificationMessageId, data, logger)).toThrow(
      'Unknown agreement code: something-else'
    )

    expect(fpttCreateOffer).not.toHaveBeenCalled()
    expect(wmpCreateOffer).not.toHaveBeenCalled()
  })

  it('rejects when code is missing', () => {
    const data = {}
    expect(() => createOffer(notificationMessageId, data, logger)).toThrow(
      'Agreement code is required'
    )

    expect(fpttCreateOffer).not.toHaveBeenCalled()
    expect(wmpCreateOffer).not.toHaveBeenCalled()
  })

  it('rejects when offer data is missing', () => {
    expect(() => createOffer(notificationMessageId, undefined, logger)).toThrow(
      'Offer data is required'
    )

    expect(fpttCreateOffer).not.toHaveBeenCalled()
    expect(wmpCreateOffer).not.toHaveBeenCalled()
  })

  it('rejects when code is not a string', () => {
    expect(() =>
      createOffer(notificationMessageId, { code: 123 }, logger)
    ).toThrow('Agreement code is required')

    expect(fpttCreateOffer).not.toHaveBeenCalled()
    expect(wmpCreateOffer).not.toHaveBeenCalled()
  })
})
