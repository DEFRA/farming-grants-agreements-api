import { errorHandlerPlugin } from './error-handler.js'
import { createServer } from '~/src/api/index.js'
import Boom from '@hapi/boom'

describe('errorHandlerPlugin', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  beforeAll(async () => {
    server = await createServer({ disableSQS: true })
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('plugin registration', () => {
    test('should have correct plugin name', () => {
      expect(errorHandlerPlugin.name).toBe('error-handler')
    })

    test('should have register function', () => {
      expect(typeof errorHandlerPlugin.register).toBe('function')
    })

    test('should register onPreResponse extension', () => {
      const mockServer = {
        ext: jest.fn()
      }

      errorHandlerPlugin.register(mockServer)

      expect(mockServer.ext).toHaveBeenCalledWith(
        'onPreResponse',
        expect.any(Function)
      )
    })
  })

  describe('error handling behavior', () => {
    beforeAll(() => {
      // Add a test route that can throw different types of errors
      server.route([
        {
          method: 'GET',
          path: '/test-boom-error',
          handler: () => {
            throw Boom.badRequest('Test boom error')
          }
        },
        {
          method: 'GET',
          path: '/test-generic-error',
          handler: () => {
            throw new Error('Test generic error')
          }
        },
        {
          method: 'GET',
          path: '/test-success',
          handler: () => {
            return { message: 'Success' }
          }
        }
      ])
    })

    test('should add cache control headers to Boom errors', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/test-boom-error'
      })

      expect(response.statusCode).toBe(400)
      // Hapi may override some cache control settings, so we check for the presence of no-cache
      expect(response.headers['cache-control']).toContain('no-cache')
      expect(response.headers.pragma).toBe('no-cache')
      expect(response.headers.expires).toBe('0')
      expect(response.headers['surrogate-control']).toBe('no-store')
    })

    test('should add cache control headers to generic errors converted to Boom', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/test-generic-error'
      })

      expect(response.statusCode).toBe(500)
      // Hapi may override some cache control settings, so we check for the presence of no-cache
      expect(response.headers['cache-control']).toContain('no-cache')
      expect(response.headers.pragma).toBe('no-cache')
      expect(response.headers.expires).toBe('0')
      expect(response.headers['surrogate-control']).toBe('no-store')
    })

    test('should not modify successful responses', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/test-success'
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['cache-control']).toBe('no-cache')
      expect(response.headers.pragma).toBeUndefined()
      expect(response.headers.expires).toBeUndefined()
      expect(response.headers['surrogate-control']).toBeUndefined()
    })

    test('should handle different Boom error types', async () => {
      // Test different HTTP status codes
      const testCases = [
        {
          path: '/test-400',
          error: Boom.badRequest('Bad request'),
          expectedStatus: 400
        },
        {
          path: '/test-401',
          error: Boom.unauthorized('Unauthorized'),
          expectedStatus: 401
        },
        {
          path: '/test-403',
          error: Boom.forbidden('Forbidden'),
          expectedStatus: 403
        },
        {
          path: '/test-404',
          error: Boom.notFound('Not found'),
          expectedStatus: 404
        },
        {
          path: '/test-500',
          error: Boom.internal('Internal error'),
          expectedStatus: 500
        }
      ]

      for (const testCase of testCases) {
        server.route({
          method: 'GET',
          path: testCase.path,
          handler: () => {
            throw testCase.error
          }
        })

        const response = await server.inject({
          method: 'GET',
          url: testCase.path
        })

        expect(response.statusCode).toBe(testCase.expectedStatus)
        expect(response.headers['cache-control']).toContain('no-cache')
      }
    })
  })

  describe('extension handler', () => {
    test('should continue processing when response is not a Boom error', () => {
      const mockRequest = {
        response: {
          isBoom: false
        }
      }
      const mockH = {
        continue: Symbol('continue')
      }

      // Get the extension handler
      const mockServer = {
        ext: jest.fn()
      }
      errorHandlerPlugin.register(mockServer)
      const extensionHandler = mockServer.ext.mock.calls[0][1]

      const result = extensionHandler(mockRequest, mockH)

      expect(result).toBe(mockH.continue)
    })

    test('should set cache headers and continue when response is a Boom error', () => {
      const mockResponse = {
        isBoom: true,
        output: {
          headers: {}
        }
      }
      const mockRequest = {
        response: mockResponse
      }
      const mockH = {
        continue: Symbol('continue')
      }

      // Get the extension handler
      const mockServer = {
        ext: jest.fn()
      }
      errorHandlerPlugin.register(mockServer)
      const extensionHandler = mockServer.ext.mock.calls[0][1]

      const result = extensionHandler(mockRequest, mockH)

      expect(result).toBe(mockH.continue)
      expect(mockResponse.output.headers['Cache-Control']).toBe(
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      )
      expect(mockResponse.output.headers.Pragma).toBe('no-cache')
      expect(mockResponse.output.headers.Expires).toBe('0')
      expect(mockResponse.output.headers['Surrogate-Control']).toBe('no-store')
    })

    test('should handle response with existing headers', () => {
      const mockResponse = {
        isBoom: true,
        output: {
          headers: {
            'existing-header': 'existing-value'
          }
        }
      }
      const mockRequest = {
        response: mockResponse
      }
      const mockH = {
        continue: Symbol('continue')
      }

      // Get the extension handler
      const mockServer = {
        ext: jest.fn()
      }
      errorHandlerPlugin.register(mockServer)
      const extensionHandler = mockServer.ext.mock.calls[0][1]

      extensionHandler(mockRequest, mockH)

      expect(mockResponse.output.headers['existing-header']).toBe(
        'existing-value'
      )
      expect(mockResponse.output.headers['Cache-Control']).toBe(
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      )
    })
  })
})
