import { statusCodes } from '~/src/api/common/constants/status-codes.js'

// use the manual mock in src/api/health/__mocks__/mongoose.js
jest.mock('mongoose')

describe('#healthController', () => {
  /** @type {Server} */
  let server
  let mongooseModule

  beforeAll(async () => {
    // import the mocked mongoose (manual mock default export)
    mongooseModule = await import('mongoose')

    // import createServer after mongoose is mocked so controller picks up the mock
    const { createServer } = await import('~/src/api/index.js')

    server = await createServer({
      disableSQS: true
    })
    await server.initialize()
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }
  })

  describe('MongoDB successfully connected', () => {
    test('Should provide expected response', async () => {
      // ensure ping resolves (success)
      mongooseModule.__mockPing.mockResolvedValueOnce({ ok: 1 })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(result).toEqual({ message: 'success' })
      expect(statusCode).toBe(statusCodes.ok)
    })
  })

  describe('MongoDB failed to connect', () => {
    test('Should return an error when MongoDB connected but the ping failed', async () => {
      // simulate mongo failure
      mongooseModule.__mockPing.mockResolvedValueOnce({ ok: 0 })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(result).toEqual({
        message: 'Unable to connect to backend MongoDB',
        error: 'MongoDB ping failed'
      })
      expect(statusCode).toBe(statusCodes.serviceUnavailable)
    })

    test('Should return an error when MongoDB is unavailable', async () => {
      // simulate mongo failure
      const err = new Error('connection refused')
      mongooseModule.__mockPing.mockRejectedValueOnce(err)

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(result).toEqual({
        message: 'Unable to connect to backend MongoDB',
        error: err.message
      })
      expect(statusCode).toBe(statusCodes.serviceUnavailable)
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
