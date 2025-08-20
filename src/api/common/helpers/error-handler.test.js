import { errorHandlerPlugin } from './error-handler.js'
import { createServer } from '~/src/api/index.js'
import Boom from '@hapi/boom'

describe('errorHandlerPlugin', () => {
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
        },
        {
          method: 'GET',
          path: '/test-403',
          handler: () => {
            throw Boom.forbidden('Forbidden')
          }
        },
        {
          method: 'GET',
          path: '/test-404',
          handler: () => {
            throw Boom.notFound('Not found')
          }
        },
        {
          method: 'GET',
          path: '/test-500',
          handler: () => {
            throw Boom.internal('Internal error')
          }
        },
        {
          method: 'GET',
          path: '/test-401',
          handler: () => {
            throw Boom.unauthorized('Unauthorized')
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
      const testCases = [
        {
          path: '/test-boom-error',
          expectedStatus: 400
        },
        {
          path: '/test-403',
          expectedStatus: 403
        },
        {
          path: '/test-404',
          expectedStatus: 404
        },
        {
          path: '/test-500',
          expectedStatus: 500
        },
        {
          path: '/test-401',
          expectedStatus: 401
        }
      ]

      for (const testCase of testCases) {
        const response = await server.inject({
          method: 'GET',
          url: testCase.path
        })

        expect(response.statusCode).toBe(testCase.expectedStatus)
        expect(response.headers['cache-control']).toContain('no-cache')
      }
    })

    test('should render unauthorized template for 401 errors', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/test-401'
      })

      expect(response.statusCode).toBe(401)
      expect(response.headers['content-type']).toContain('text/html')
      expect(response.payload).toContain(
        'You are not authorized to access this page'
      )
      expect(response.headers['cache-control']).toContain('no-cache')
      expect(response.headers.pragma).toBe('no-cache')
      expect(response.headers.expires).toBe('0')
      expect(response.headers['surrogate-control']).toBe('no-store')
    })
  })

  describe('extension handler', () => {
    test('should continue processing when response is not a Boom error', async () => {
      const mockRequest = {
        response: {
          isBoom: false
        }
      }
      const mockH = {
        continue: Symbol('continue')
      }

      const mockServer = {
        ext: jest.fn()
      }
      errorHandlerPlugin.register(mockServer)
      const extensionHandler = mockServer.ext.mock.calls[0][1]

      const result = await extensionHandler(mockRequest, mockH)

      expect(result).toBe(mockH.continue)
    })

    test('should set cache headers and continue when response is a Boom error', async () => {
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

      const mockServer = {
        ext: jest.fn()
      }
      errorHandlerPlugin.register(mockServer)
      const extensionHandler = mockServer.ext.mock.calls[0][1]

      const result = await extensionHandler(mockRequest, mockH)

      expect(result).toBe(mockH.continue)
      expect(mockResponse.output.headers['Cache-Control']).toBe(
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      )
      expect(mockResponse.output.headers.Pragma).toBe('no-cache')
      expect(mockResponse.output.headers.Expires).toBe('0')
      expect(mockResponse.output.headers['Surrogate-Control']).toBe('no-store')
    })

    test('should handle response with existing headers', async () => {
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

      const mockServer = {
        ext: jest.fn()
      }
      errorHandlerPlugin.register(mockServer)
      const extensionHandler = mockServer.ext.mock.calls[0][1]

      await extensionHandler(mockRequest, mockH)

      expect(mockResponse.output.headers['existing-header']).toBe(
        'existing-value'
      )
      expect(mockResponse.output.headers['Cache-Control']).toBe(
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      )
    })

    test('should continue when unauthorized template rendering fails', async () => {
      const mockRequest = {
        response: {
          isBoom: true,
          output: {
            statusCode: 401,
            headers: {}
          },
          message: 'Unauthorized'
        },
        server: { logger: { info: jest.fn(), error: jest.fn() } }
      }
      const mockH = {
        continue: Symbol('continue'),
        view: jest.fn(() => {
          throw new Error('Render failed')
        })
      }

      const mockServer = { ext: jest.fn() }
      errorHandlerPlugin.register(mockServer)
      const extensionHandler = mockServer.ext.mock.calls[0][1]

      const result = await extensionHandler(mockRequest, mockH)

      expect(result).toBe(mockH.continue)
      expect(mockRequest.server.logger.error).toHaveBeenCalled()
    })
  })
})
