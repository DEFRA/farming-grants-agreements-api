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

  it('routes code "fptt" to fpttCreateOffer', async () => {
    const data = { code: 'fptt' }
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

  it('falls back to fpttCreateOffer for an unknown code', async () => {
    const data = { code: 'something-else' }
    const result = await createOffer(notificationMessageId, data, logger)

    expect(fpttCreateOffer).toHaveBeenCalledWith(
      notificationMessageId,
      data,
      logger
    )
    expect(wmpCreateOffer).not.toHaveBeenCalled()
    expect(result).toBe('fptt-result')
  })

  it('falls back to fpttCreateOffer when code is missing', async () => {
    const data = {}
    await createOffer(notificationMessageId, data, logger)

    expect(fpttCreateOffer).toHaveBeenCalledWith(
      notificationMessageId,
      data,
      logger
    )
    expect(wmpCreateOffer).not.toHaveBeenCalled()
  })
})
