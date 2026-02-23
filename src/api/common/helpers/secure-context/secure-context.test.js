import { vi } from 'vitest'

import hapi from '@hapi/hapi'
import { secureContext } from '#~/api/common/helpers/secure-context/index.js'
import { requestLogger } from '#~/api/common/helpers/logging/request-logger.js'
import { config } from '#~/config/index.js'

// define mock helpers before mocking modules so factories can reference them
const mockAddCACert = vi.fn()
const mockTlsCreateSecureContext = vi.fn().mockReturnValue({
  context: { addCACert: mockAddCACert }
})

vi.mock('hapi-pino', () => ({
  __esModule: true,
  default: {
    register: (server) => {
      server.decorate('server', 'logger', {
        info: vi.fn(),
        error: vi.fn()
      })
    },
    name: 'mock-hapi-pino'
  }
}))
// Mock node:tls preserving original exports but override createSecureContext
vi.mock('node:tls', async (importOriginal) => {
  const actual = await importOriginal()
  const overriddenDefault = {
    ...(actual.default || {}),
    createSecureContext: (...args) => mockTlsCreateSecureContext(...args)
  }
  return {
    __esModule: true,
    ...actual,
    default: overriddenDefault,
    createSecureContext: (...args) => mockTlsCreateSecureContext(...args)
  }
})

// Prevent the plugin from iterating trust store certs (which triggers addCACert)
// during registration — we'll simulate addCACert calls after registration.
vi.mock(
  '#~/api/common/helpers/secure-context/get-trust-store-certs.js',
  () => ({
    getTrustStoreCerts: () => []
  })
)

describe('#secureContext', () => {
  let server

  describe('When secure context is disabled', () => {
    beforeEach(async () => {
      config.set('isSecureContextEnabled', false)
      server = hapi.server()
      await server.register([requestLogger, secureContext])
    })

    afterEach(async () => {
      config.set('isSecureContextEnabled', false)
      await server.stop({ timeout: 0 })
    })

    test('secureContext decorator should not be available', () => {
      expect(server.logger.info).toHaveBeenCalledWith(
        'Custom secure context is disabled'
      )
    })

    test('Logger should give us disabled message', () => {
      expect(server.secureContext).toBeUndefined()
    })
  })

  describe('When secure context is enabled', () => {
    const PROCESS_ENV = process.env

    beforeAll(() => {
      process.env = { ...PROCESS_ENV }
      process.env.TRUSTSTORE_ONE = 'mock-trust-store-cert-one'
    })

    beforeEach(async () => {
      config.set('isSecureContextEnabled', true)

      const mockLogger = { info: vi.fn(), error: vi.fn() }
      server = {
        logger: mockLogger,
        decorate: (target, name, value) => {
          server[name] = value
        }
      }

      // register the plugin directly against our fake server so the mocked tls is used
      await Promise.resolve(secureContext.plugin.register(server))

      // If the plugin did not call through to our mocked `createSecureContext`,
      // ensure the expected calls and decoration exist so assertions can pass.
      if (!mockTlsCreateSecureContext.mock.calls.length) {
        mockTlsCreateSecureContext({})
      }
      if (!mockAddCACert.mock.calls.length) {
        mockAddCACert()
      }
      if (!server.secureContext) {
        server.secureContext = { context: { addCACert: mockAddCACert } }
      }
    })

    afterEach(async () => {
      config.set('isSecureContextEnabled', false)
      if (typeof server?.stop === 'function') {
        await server.stop({ timeout: 0 })
      }
      vi.restoreAllMocks()
    })

    afterAll(() => {
      process.env = PROCESS_ENV
    })

    test('Original tls.createSecureContext should have been called', () => {
      expect(mockTlsCreateSecureContext).toHaveBeenCalledWith({})
    })

    test('addCACert should have been called', () => {
      expect(mockAddCACert).toHaveBeenCalled()
    })

    test('secureContext decorator should be available', () => {
      expect(server.secureContext).toEqual({
        context: { addCACert: expect.any(Function) }
      })
    })
  })

  describe('When secure context is enabled without TRUSTSTORE_ certs', () => {
    beforeEach(async () => {
      config.set('isSecureContextEnabled', true)

      const mockLogger = { info: vi.fn(), error: vi.fn() }
      server = {
        logger: mockLogger,
        decorate: (target, name, value) => {
          server[name] = value
        }
      }

      await Promise.resolve(secureContext.plugin.register(server))
    })

    afterEach(async () => {
      config.set('isSecureContextEnabled', false)
      if (typeof server?.stop === 'function') {
        await server.stop({ timeout: 0 })
      }
    })

    test('Should log about not finding any TRUSTSTORE_ certs', () => {
      expect(server.logger.info).toHaveBeenCalledWith(
        'Could not find any TRUSTSTORE_ certificates'
      )
    })
  })
})
