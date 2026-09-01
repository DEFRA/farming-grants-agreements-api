import Boom from '@hapi/boom'
import { createHash, timingSafeEqual } from 'node:crypto'

import { config } from '#~/config/index.js'

const sha256 = (value) => createHash('sha256').update(value).digest()

const getBearerToken = (header) => {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    throw Boom.unauthorized('Invalid migration token')
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    throw Boom.unauthorized('Invalid migration token')
  }

  return token
}

export const migrationTokenScheme = () => ({
  authenticate(request, h) {
    const actual = sha256(getBearerToken(request.headers.authorization))
    const expected = Buffer.from(
      config.get('woodlandMigrationTokenHash'),
      'hex'
    )

    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw Boom.unauthorized('Invalid migration token')
    }

    return h.authenticated({ credentials: { service: 'gas' } })
  }
})
