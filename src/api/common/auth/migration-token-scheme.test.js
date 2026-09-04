import { createHash } from 'node:crypto'

import { config } from '#~/config/index.js'
import { migrationTokenScheme } from './migration-token-scheme.js'

const token = 'migration-source-secret'
const tokenHash = createHash('sha256').update(token).digest('hex')

const h = {
  authenticated: vi.fn((value) => value)
}

describe('migrationTokenScheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.set('migrationSourceTokenHash', tokenHash)
  })

  it('accepts the configured migration token', () => {
    const result = migrationTokenScheme().authenticate(
      { headers: { authorization: `Bearer ${token}` } },
      h
    )

    expect(result).toEqual({ credentials: { service: 'gas' } })
  })

  it.each([undefined, 'Basic secret', 'Bearer ', 'Bearer wrong'])(
    'rejects an invalid authorization header',
    (authorization) => {
      expect(() =>
        migrationTokenScheme().authenticate({ headers: { authorization } }, h)
      ).toThrow('Invalid migration token')
    }
  )
})
