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
