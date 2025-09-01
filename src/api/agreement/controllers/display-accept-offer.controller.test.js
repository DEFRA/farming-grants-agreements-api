import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'

// Mock the modules
jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  __esModule: true,
  ...jest.requireActual('~/src/api/agreement/helpers/get-agreement-data.js'),
  getAgreementDataById: jest.fn()
}))
jest.mock('~/src/api/common/helpers/jwt-auth.js')

describe('displayAcceptOfferController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  beforeAll(async () => {
    server = await createServer({ disableSQS: true })
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()

    // Setup default mock implementations
    jest.spyOn(agreementDataHelper, 'getAgreementDataById')
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(true)
  })

  describe('not yet accepted', () => {
    test('should return the rendered HTML accept offer page', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, headers, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'display-accept'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(headers['content-type']).toContain('text/html')
      expect(String(result)).toContain('Accept your offer')
    })

    test('should handle agreement not found', async () => {
      const agreementId = 'INVALID123'
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(null)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'display-accept'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(500)
      expect(String(result)).toContain('Cannot read properties of null')
    })

    test('should handle base URL header', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'display-accept'
        },
        headers: {
          'x-base-url': '/defra-grants-proxy',
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Accept your offer')
      expect(String(result)).toContain('/defra-grants-proxy')
    })

    test('should handle database errors', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const errorMessage = 'Database connection failed'
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockRejectedValue(new Error(errorMessage))

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'display-accept'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(String(result)).toContain('Database connection failed')
    })

    describe('template rendering errors', () => {
      let originalView

      beforeEach(() => {
        // Mock the view rendering to throw an error
        originalView =
          server.realm.plugins.vision.manager._engines.njk.compileFunc
        server.realm.plugins.vision.manager._engines.njk.compileFunc = () => {
          throw new Error('Template rendering failed')
        }
      })

      afterEach(() => {
        // Restore the original view function
        server.realm.plugins.vision.manager._engines.njk.compileFunc =
          originalView
      })

      test('should handle template rendering errors', async () => {
        // Arrange
        const agreementId = 'SFI123456789'
        const mockAgreementData = {
          agreementNumber: agreementId,
          status: 'offered',
          company: 'Test Company',
          sbi: '106284736',
          username: 'Test User'
        }

        jest
          .spyOn(agreementDataHelper, 'getAgreementDataById')
          .mockResolvedValue(mockAgreementData)

        // Act
        const { statusCode, result } = await server.inject({
          method: 'POST',
          url: `/${agreementId}`,
          payload: {
            action: 'display-accept'
          },
          headers: {
            'x-encrypted-auth': 'valid-jwt-token'
          }
        })

        // Assert
        expect(statusCode).toBe(statusCodes.internalServerError)
        expect(result).toEqual({
          error: 'Internal Server Error',
          message: 'An internal server error occurred',
          statusCode: 500
        })
      })
    })
  })

  describe('already accepted', () => {
    const agreementId = 'SFI123456789'

    beforeEach(() => {
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'accepted',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)
    })

    test('should render accept offer page even when already accepted', async () => {
      // Arrange
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'accept-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Offer accepted')
    })

    test('should render accept offer page with base URL when already accepted', async () => {
      // Arrange
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'accept-offer'
        },
        headers: {
          'x-base-url': '/defra-grants-proxy',
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Offer accepted')
      expect(String(result)).toContain('/defra-grants-proxy')
    })
  })
})
