import hapi from '@hapi/hapi'

const mockLoggerInfo = jest.fn()
const mockLoggerWarn = jest.fn()
const mockLoggerError = jest.fn()

const mockHapiLoggerInfo = jest.fn()
const mockHapiLoggerWarn = jest.fn()
const mockHapiLoggerError = jest.fn()

jest.mock('hapi-pino', () => ({
  register: (server) => {
    server.decorate('server', 'logger', {
      info: mockHapiLoggerInfo,
      warn: mockHapiLoggerWarn,
      error: mockHapiLoggerError
    })
  },
  name: 'mock-hapi-pino'
}))
jest.mock('~/src/api/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({
    info: (...args) => mockLoggerInfo(...args),
    warn: (...args) => mockLoggerWarn(...args),
    error: (...args) => mockLoggerError(...args)
  })
}))

describe('#startServer', () => {
  const PROCESS_ENV = process.env
  let createServerSpy
  let hapiServerSpy
  let startServerImport
  let createServerImport

  beforeAll(async () => {
    process.env = { ...PROCESS_ENV }
    process.env.PORT = '3098' // Set to obscure port to avoid conflicts

    // Explicitly disable DB seeding for test consistency
    const { config } = await import('~/src/config/index.js')
    config.set('featureFlags.seedDb', false)

    createServerImport = await import('~/src/api/index.js')
    startServerImport = await import('~/src/api/common/helpers/start-server.js')

    createServerSpy = jest.spyOn(createServerImport, 'createServer')
    hapiServerSpy = jest.spyOn(hapi, 'server')
  })

  afterAll(() => {
    process.env = PROCESS_ENV
  })

  describe('When server starts', () => {
    let server

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('Should start up server as expected', async () => {
      server = await startServerImport.startServer({ disableSQS: true })

      expect(createServerSpy).toHaveBeenCalled()
      expect(hapiServerSpy).toHaveBeenCalled()
      expect(mockHapiLoggerInfo).toHaveBeenNthCalledWith(
        1,
        'Custom secure context is disabled'
      )
      expect(mockHapiLoggerInfo).toHaveBeenNthCalledWith(
        2,
        'Setting up mongoose'
      )
      expect(mockHapiLoggerInfo).toHaveBeenNthCalledWith(
        3,
        'Server started successfully'
      )
      expect(mockHapiLoggerInfo).toHaveBeenNthCalledWith(
        4,
        'Access your backend on http://localhost:3098'
      )
    })
  })

  describe('When server start fails', () => {
    beforeAll(() => {
      createServerSpy.mockRejectedValue(new Error('Server failed to start'))
    })

    test('Should log failed startup message', async () => {
      await startServerImport.startServer({ disableSQS: true })

      expect(mockLoggerInfo).toHaveBeenCalledWith('Server failed to start :(')
      expect(mockLoggerError).toHaveBeenCalledWith(
        Error('Server failed to start')
      )
    })
  })
})

/**
 * @file start-server.csp.test.js
 * Verifies the onPreResponse CSP middleware:
 *  - registers onPreResponse
 *  - sets CSP on normal and Boom responses
 *  - injects cspNonce into view context
 *  - fresh nonce per response
 */

describe('start-server CSP onPreResponse', () => {
  let startServer
  let extHandler
  let fakeServer

  const mockServerFactory = () => {
    fakeServer = {
      ext: jest.fn((event, fn) => {
        if (event === 'onPreResponse') extHandler = fn
      }),
      start: jest.fn().mockResolvedValue(undefined),
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    }
    return fakeServer
  }

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()

    jest.doMock('~/src/config/index.js', () => ({
      config: { get: () => 3098, set: jest.fn() }
    }))

    jest.doMock('~/src/api/index.js', () => ({
      createServer: jest.fn().mockResolvedValue(mockServerFactory())
    }))

    jest.doMock('~/src/api/common/helpers/logging/logger.js', () => ({
      createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      })
    }))
    ;({ startServer } = await import(
      '~/src/api/common/helpers/start-server.js'
    ))
    await startServer({ disableSQS: true }) // just setup; no expects here
  })

  test('registers an onPreResponse handler', () => {
    expect(fakeServer.ext).toHaveBeenCalledWith(
      'onPreResponse',
      expect.any(Function)
    )
    expect(typeof extHandler).toBe('function')
  })

  test('sets CSP header on a normal (non-Boom) response', async () => {
    const header = jest.fn()
    const request = {
      app: {},
      response: { isBoom: false, variety: 'plain', header }
    }
    const h = { continue: Symbol('continue') }

    const res = await extHandler(request, h)

    expect(header).toHaveBeenCalledWith(
      'content-security-policy',
      expect.stringMatching(
        /script-src 'self' 'strict-dynamic' 'nonce-[A-Za-z0-9+/=]+'; object-src 'none'; base-uri 'self'/
      )
    )
    expect(request.app.cspNonce).toEqual(
      expect.stringMatching(/^[A-Za-z0-9+/=]+$/)
    )
    expect(res).toBe(h.continue)
  })

  test('sets CSP header on Boom responses', async () => {
    const request = {
      app: {},
      response: { isBoom: true, output: { headers: {} } }
    }
    const h = { continue: Symbol('continue') }

    await extHandler(request, h)

    const csp = request.response.output.headers['content-security-policy']
    expect(csp).toMatch(
      /script-src 'self' 'strict-dynamic' 'nonce-[A-Za-z0-9+/=]+'/
    )
    expect(csp).toMatch(/object-src 'none'; base-uri 'self'/)
    expect(request.app.cspNonce).toBeDefined()
  })

  test('injects cspNonce into view context', async () => {
    const header = jest.fn()
    const request = {
      app: {},
      response: {
        isBoom: false,
        variety: 'view',
        header,
        source: { context: { existing: 'kept' } }
      }
    }
    const h = { continue: Symbol('continue') }

    await extHandler(request, h)

    expect(header).toHaveBeenCalledWith(
      'content-security-policy',
      expect.stringMatching(/nonce-/)
    )
    expect(request.response.source.context.cspNonce).toBeDefined()
    expect(request.response.source.context.existing).toBe('kept')
  })

  test('generates a fresh nonce per response', async () => {
    const header = jest.fn()
    const h = { continue: Symbol('continue') }

    const req1 = {
      app: {},
      response: { isBoom: false, variety: 'plain', header }
    }
    await extHandler(req1, h)
    const nonce1 = req1.app.cspNonce

    const req2 = {
      app: {},
      response: { isBoom: false, variety: 'plain', header }
    }
    await extHandler(req2, h)
    const nonce2 = req2.app.cspNonce

    expect(nonce1).toBeDefined()
    expect(nonce2).toBeDefined()
    expect(nonce1).not.toEqual(nonce2)
  })
})
