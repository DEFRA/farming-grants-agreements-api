import { config } from '../../index.js'

const mockReadFileSync = jest.fn()
const mockLoggerError = jest.fn()

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  readFileSync: () => mockReadFileSync()
}))
jest.mock('~/src/api/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: (...args) => mockLoggerError(...args) })
}))

describe('#context', () => {
  const mockRequest = { path: '/' }
  let contextResult

  describe('When webpack manifest file read succeeds', () => {
    let contextImport

    beforeAll(async () => {
      contextImport = await import('~/src/config/nunjucks/context/context.js')
    })

    beforeEach(async () => {
      // Return JSON string
      mockReadFileSync.mockReturnValue(`{
        "application.js": "javascripts/application.js",
        "stylesheets/application.scss": "stylesheets/application.css"
      }`)

      contextResult = await contextImport.context(mockRequest)
    })

    test('Should provide expected context', () => {
      expect(contextResult).toEqual({
        baseUrl: '/',
        assetPath: '/public/assets/rebrand',
        breadcrumbs: [],
        navigation: [
          {
            isActive: true,
            text: 'Home',
            url: '/'
          },
          {
            isActive: false,
            text: 'About',
            url: '/about'
          }
        ],
        serviceName: config.get('serviceName'),
        serviceTitle: config.get('serviceTitle'),
        auth: {
          isAuthenticated: false,
          name: undefined,
          role: undefined,
          organisationId: undefined,
          sbi: 106284736
        }
      })
    })
  })

  describe('When webpack manifest file read fails', () => {
    let contextImport

    beforeAll(async () => {
      contextImport = await import('~/src/config/nunjucks/context/context.js')
    })

    beforeEach(() => {
      mockReadFileSync.mockReturnValue(new Error('File not found'))

      contextResult = contextImport.context(mockRequest)
    })

    test('Should log that the Webpack Manifest file is not available', () => {
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Webpack assets-manifest.json not found'
      )
    })
  })
})

describe('#context cache', () => {
  const mockRequest = { path: '/' }
  let contextResult

  describe('Webpack manifest file cache', () => {
    let contextImport

    beforeAll(async () => {
      contextImport = await import('~/src/config/nunjucks/context/context.js')
    })

    beforeEach(async () => {
      // Return JSON string
      mockReadFileSync.mockReturnValue(`{
        "application.js": "javascripts/application.js",
        "stylesheets/application.scss": "stylesheets/application.css"
      }`)

      contextResult = await contextImport.context(mockRequest)
    })

    test('Should read file', () => {
      expect(mockReadFileSync).toHaveBeenCalled()
    })

    test('Should use cache', () => {
      expect(mockReadFileSync).not.toHaveBeenCalled()
    })

    test('Should provide expected context', () => {
      expect(contextResult).toEqual({
        baseUrl: '/',
        assetPath: '/public/assets/rebrand',
        breadcrumbs: [],
        navigation: [
          {
            isActive: true,
            text: 'Home',
            url: '/'
          },
          {
            isActive: false,
            text: 'About',
            url: '/about'
          }
        ],
        serviceName: config.get('serviceName'),
        serviceTitle: config.get('serviceTitle'),
        auth: {
          isAuthenticated: false,
          name: undefined,
          organisationId: undefined,
          role: undefined,
          sbi: 106284736
        }
      })
    })
  })
})
