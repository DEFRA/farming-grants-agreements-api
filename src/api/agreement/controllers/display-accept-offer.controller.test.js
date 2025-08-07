import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as nunjucksRenderer from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'

// Mock the modules
jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  __esModule: true,
  ...jest.requireActual('~/src/api/agreement/helpers/get-agreement-data.js'),
  getAgreementDataById: jest.fn()
}))
jest.mock('~/src/api/common/helpers/jwt-auth.js')

describe('displayAcceptOfferController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const mockRenderedHtml = `<!DOCTYPE html><html><body>Test accept offer HTML</body></html>`

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
    jest
      .spyOn(nunjucksRenderer, 'renderTemplate')
      .mockImplementation(() => mockRenderedHtml)

    // Mock JWT auth functions to return valid authorization by default
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
        method: 'GET',
        url: `/review-accept-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(headers['content-type']).toContain('text/html')
      expect(result).toBe(mockRenderedHtml)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/accept-offer.njk',
        expect.objectContaining({
          agreementNumber: agreementId,
          company: 'Test Company',
          sbi: '106284736',
          farmerName: 'Test User',
          status: 'offered',
          baseUrl: '/'
        })
      )
    })

    test('should handle agreement not found', async () => {
      const agreementId = 'INVALID123'
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(null)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-accept-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(500)
      expect(result).toEqual({
        message: 'Failed to display accept offer page',
        error: "Cannot read properties of null (reading 'status')"
      })
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
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-accept-offer/${agreementId}`,
        headers: {
          'x-base-url': '/defra-grants-proxy',
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/accept-offer.njk',
        expect.objectContaining({
          baseUrl: '/defra-grants-proxy',
          status: 'offered'
        })
      )
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
        method: 'GET',
        url: `/review-accept-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toEqual({
        message: 'Failed to display accept offer page',
        error: errorMessage
      })
    })

    test('should handle template rendering errors', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const errorMessage = 'Template rendering failed'
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
      jest.spyOn(nunjucksRenderer, 'renderTemplate').mockImplementation(() => {
        throw new Error(errorMessage)
      })

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-accept-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toEqual({
        message: 'Failed to display accept offer page',
        error: errorMessage
      })
    })

    // JWT Authorization Tests
    describe('JWT Authorization', () => {
      beforeEach(() => {
        jest.clearAllMocks()

        // Setup default mock implementations
        jest
          .spyOn(agreementDataHelper, 'getAgreementDataById')
          .mockResolvedValue({
            agreementNumber: 'SFI123456789',
            status: 'offered',
            company: 'Test Company',
            sbi: '106284736',
            username: 'Test User'
          })
        jest
          .spyOn(nunjucksRenderer, 'renderTemplate')
          .mockImplementation(() => mockRenderedHtml)
      })

      test('Should return 401 when invalid JWT token provided', async () => {
        // Arrange
        jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(false)

        // Act
        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: '/review-accept-offer/SFI123456789',
          headers: {
            'x-encrypted-auth': 'invalid-token'
          }
        })

        // Assert
        expect(statusCode).toBe(statusCodes.unauthorized)
        expect(result).toEqual({
          message: 'Not authorized to display accept offer agreement document'
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

    test('should redirect to review offer', async () => {
      // Arrange
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/review-accept-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`/offer-accepted/${agreementId}`)
      expect(nunjucksRenderer.renderTemplate).not.toHaveBeenCalled()
    })

    test('should redirect to review offer when base URL is set', async () => {
      // Arrange
      const agreementId = 'SFI123456789'

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/review-accept-offer/${agreementId}`,
        headers: {
          'x-base-url': '/defra-grants-proxy'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/defra-grants-proxy/offer-accepted/${agreementId}`
      )
      expect(nunjucksRenderer.renderTemplate).not.toHaveBeenCalled()
    })
  })
})
