import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
import * as getHTMLAgreement from '~/src/api/agreement/helpers/get-html-agreement.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'

// Mock the modules
jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  __esModule: true,
  ...jest.requireActual('~/src/api/agreement/helpers/get-agreement-data.js'),
  getAgreementDataById: jest.fn()
}))
jest.mock('~/src/api/agreement/helpers/get-html-agreement.js')
jest.mock('~/src/api/common/helpers/jwt-auth.js')
jest.mock('@hapi/jwt')

describe('viewAgreementController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const mockRenderedHtml = `<html><body>Test HTML with SFI123456789</body></html>`

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

    // Mock default successful responses for all tests
    jest
      .spyOn(getHTMLAgreement, 'getHTMLAgreementDocument')
      .mockResolvedValue(mockRenderedHtml)

    // Mock JWT auth functions
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(true)
  })

  describe('Offer accepted', () => {
    const mockAgreementData = {
      sbi: '106284736',
      status: 'accepted',
      agreementNumber: 'SFI123456789'
    }

    beforeEach(() => {
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)
    })

    test('Should return HTML when valid agreement ID and valid auth are provided', async () => {
      // Arrange
      const agreementId = 'SFI123456789'

      // Act
      const { statusCode, headers, payload } = await server.inject({
        method: 'GET',
        url: `/view-agreement/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(headers['content-type']).toContain('text/html')
      expect(payload).toBe(mockRenderedHtml)

      // Verify mocks were called correctly
      expect(agreementDataHelper.getAgreementDataById).toHaveBeenCalledWith(
        agreementId
      )
      expect(getHTMLAgreement.getHTMLAgreementDocument).toHaveBeenCalledWith(
        agreementId,
        mockAgreementData,
        '/'
      )
    })

    test('Should handle missing agreement ID', async () => {
      // Act
      const { statusCode, headers, payload } = await server.inject({
        method: 'GET',
        url: '/view-agreement/undefined',
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(headers['content-type']).toContain('text/html')
      expect(payload).toBe(mockRenderedHtml)

      // Verify the function defaulted to a reasonable value when ID was missing
      expect(agreementDataHelper.getAgreementDataById).toHaveBeenCalledWith(
        'undefined'
      )
    })

    test('Should handle error when template rendering fails', async () => {
      // Arrange
      const errorMessage = 'Failed to render HTML'
      jest
        .spyOn(getHTMLAgreement, 'getHTMLAgreementDocument')
        .mockRejectedValue(new Error(errorMessage))

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/view-agreement/SFI123456789',
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toEqual({
        message: 'Failed to generate agreement document',
        error: errorMessage
      })
    })

    test('Should handle error when agreement data retrieval fails', async () => {
      // Arrange
      const errorMessage = 'Failed to render HTML'
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockImplementation(() => {
          throw new Error(errorMessage)
        })

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/view-agreement/SFI123456789'
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toEqual({
        message: 'Failed to generate agreement document',
        error: errorMessage
      })
    })

    // JWT Authorization Tests
    describe('JWT Authorization', () => {
      beforeEach(() => {
        jest.clearAllMocks()

        // Mock default successful responses
        jest
          .spyOn(agreementDataHelper, 'getAgreementDataById')
          .mockResolvedValue(mockAgreementData)

        jest
          .spyOn(getHTMLAgreement, 'getHTMLAgreementDocument')
          .mockResolvedValue(mockRenderedHtml)
      })

      test('Should return 401 when invalid JWT token provided', async () => {
        // Arrange
        jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(false)

        // Act
        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: '/view-agreement/SFI123456789',
          headers: {
            'x-encrypted-auth': 'invalid-token'
          }
        })

        // Assert
        expect(statusCode).toBe(statusCodes.unauthorized)
        expect(result).toEqual({
          message: 'Not authorized to view offer agreement document'
        })
      })
    })
  })

  describe('Offer not accepted', () => {
    const agreementId = 'SFI123456789'

    const mockAgreementData = {
      sbi: '106284736',
      status: 'offered',
      agreementNumber: 'SFI123456789'
    }

    beforeEach(() => {
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)
    })

    test('Should redirect to review offer', async () => {
      // Act
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/view-agreement/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`/review-offer/${agreementId}`)
    })

    test('Should redirect to review offer with base URL', async () => {
      // Act
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/view-agreement/${agreementId}`,
        headers: {
          'x-base-url': '/defra-grants-proxy',
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/defra-grants-proxy/review-offer/${agreementId}`
      )
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
