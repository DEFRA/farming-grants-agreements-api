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
  let contextImport
  let cfg

  beforeAll(async () => {
    process.env.JWT_ENABLED = 'false'
    jest.resetModules()
    ;({ config: cfg } = await import('~/src/config/index.js'))
    contextImport = await import('~/src/config/nunjucks/context/context.js')
  })

  describe('When JWT is enabled and user is authenticated', () => {
    beforeAll(async () => {
      process.env.JWT_ENABLED = 'true'
      jest.resetModules()
      ;({ config: cfg } = await import('~/src/config/index.js'))
      contextImport = await import('~/src/config/nunjucks/context/context.js')
    })

    beforeEach(() => {
      mockReadFileSync.mockReturnValue(`{
        "application.js": "javascripts/application.js",
        "stylesheets/application.scss": "stylesheets/application.css"
      }`)
    })

    test('Should set auth.name from session.name', async () => {
      const mockRequest = {
        path: '/',
        auth: {
          isAuthenticated: true,
          credentials: {
            name: 'Joe Bloggs',
            sbi: 123456789,
            organisationId: 'org-1',
            role: 'farmer'
          }
        }
      }

      const result = await contextImport.context(mockRequest)
      expect(result.auth.name).toBe('Joe Bloggs')
    })

    afterAll(async () => {
      process.env.JWT_ENABLED = 'false'
      jest.resetModules()
      ;({ config: cfg } = await import('~/src/config/index.js'))
      contextImport = await import('~/src/config/nunjucks/context/context.js')
    })
  })

  describe('When webpack manifest file read succeeds', () => {
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
        serviceName: cfg.get('serviceName'),
        serviceTitle: cfg.get('serviceTitle'),
        auth: {
          isAuthenticated: false,
          name: 'Unauthenticated user',
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
      process.env.JWT_ENABLED = 'false'
      jest.resetModules()
      ;({ config: cfg } = await import('~/src/config/index.js'))
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

  describe('#context cache', () => {
    const mockRequest = {
      path: '/',
      auth: { credentials: { agreementData: { agreementNumber: 'test' } } }
    }
    let contextResult

    describe('Webpack manifest file cache', () => {
      beforeEach(async () => {
        jest.resetModules()
        mockReadFileSync.mockClear()

        // Return JSON string
        mockReadFileSync.mockReturnValue(`{
        "application.js": "javascripts/application.js",
        "stylesheets/application.scss": "stylesheets/application.css"
      }`)

        // Re-import to reset internal module cache (webpackManifest)
        contextImport = await import('~/src/config/nunjucks/context/context.js')

        // First call should read the file and populate cache
        contextResult = contextImport.context(mockRequest)
      })

      test('Should read file', () => {
        expect(mockReadFileSync).toHaveBeenCalled()
      })

      test('Should use cache', async () => {
        mockReadFileSync.mockClear()
        await contextImport.context(mockRequest)
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
          serviceName: cfg.get('serviceName'),
          serviceTitle: cfg.get('serviceTitle'),
          auth: {
            isAuthenticated: false,
            name: 'Unauthenticated user',
            organisationId: undefined,
            role: undefined,
            sbi: 106284736
          },
          agreement: { agreementNumber: 'test' }
        })
      })
    })
  })
})
