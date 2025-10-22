import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { createServer } from '~/src/api/index.js'
import fs from 'fs'
import path from 'path'
import Wreck from '@hapi/wreck'

jest.mock('@hapi/wreck', () => ({
  get: jest.fn()
}))

describe('#serveStaticFiles', () => {
  let server

  beforeAll(async () => {
    // Mock the well-known OIDC config before server starts
    Wreck.get.mockResolvedValue({
      payload: {
        authorization_endpoint: 'https://mock-auth/authorize',
        token_endpoint: 'https://mock-auth/token'
      }
    })
    server = await createServer({ disableSQS: true })
    await server.initialize()
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }
  })

  describe('When secure context is disabled', () => {
    test('Should serve favicon as expected', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/favicon.ico'
      })

      expect(statusCode).toBe(statusCodes.noContent)
    })

    test.skip('Should serve assets as expected', async () => {
      // TODO This test is disabled because the webpack build system was removed.
      // The test expects assets built by webpack to exist in .public/assets/images/.
      // I'll remove it entirely in a subsequent PR once I've removed static file serving.
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/public/assets/images/govuk-crest.svg'
      })
      expect(statusCode).toBe(statusCodes.ok)
    })

    test('Should serve image from /public/assets/images as expected', async () => {
      const filePath = path.resolve(
        '.public/assets/images/govuk-icon-print.png'
      )
      const expectedStatus = fs.existsSync(filePath)
        ? statusCodes.ok
        : statusCodes.notFound

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/public/assets/images/govuk-icon-print.png'
      })

      expect(statusCode).toBe(expectedStatus)
    })

    test('Should serve image from /assets/images as expected', async () => {
      const filePath = path.resolve(
        '.public/assets/images/govuk-icon-print.png'
      )
      const expectedStatus = fs.existsSync(filePath)
        ? statusCodes.ok
        : statusCodes.notFound

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/assets/images/govuk-icon-print.png'
      })

      expect(statusCode).toBe(expectedStatus)
    })

    test('Should return 404 for an invalid static file route', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/static/assets/images/i-dont-exist.png'
      })
      expect(statusCode).toBe(statusCodes.notFound)
    })
  })
})
