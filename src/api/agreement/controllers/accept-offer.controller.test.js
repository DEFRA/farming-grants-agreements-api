import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import { getAgreementDataById } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'

jest.mock('~/src/api/agreement/helpers/accept-offer.js')
jest.mock('~/src/api/agreement/helpers/update-payment-hub.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  __esModule: true,
  ...jest.requireActual('~/src/api/agreement/helpers/get-agreement-data.js'),
  getAgreementDataById: jest.fn()
}))
jest.mock('~/src/api/common/helpers/jwt-auth.js')

describe('acceptOfferDocumentController', () => {
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
    jest.clearAllMocks()

    // Reset mock implementations
    acceptOffer.mockReset()
    getAgreementDataById.mockReset()
    updatePaymentHub.mockReset()

    acceptOffer.mockResolvedValue()
    updatePaymentHub.mockResolvedValue()
  })

  describe('not yet accepted', () => {
    beforeEach(() => {
      // Setup default mock implementations
      getAgreementDataById.mockResolvedValue({
        agreementNumber: 'SFI123456789',
        status: 'offered',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      })

      // Mock JWT auth functions to return valid authorization by default
      jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(true)
    })

    test('should successfully accept an offer and return 200 OK', async () => {
      const mockLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() }
      // Register a test-only extension to inject the mock logger
      server.ext('onPreHandler', (request, h) => {
        request.logger = mockLogger
        return h.continue
      })

      const agreementId = 'SFI123456789'

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accept-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(getAgreementDataById).toHaveBeenCalledWith(agreementId)
      expect(acceptOffer).toHaveBeenCalledWith(
        {
          agreementNumber: agreementId,
          company: 'Test Company',
          sbi: '106284736',
          status: 'offered',
          username: 'Test User'
        },
        mockLogger
      )
      expect(updatePaymentHub).toHaveBeenCalled()
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Offer accepted')
      expect(String(result)).toContain(agreementId)
    })

    test('should handle agreement not found error', async () => {
      // Arrange
      const agreementId = 'invalid-agreement-id'
      getAgreementDataById.mockResolvedValue(null)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accept-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(500)
      expect(result.message).toBe('Failed to accept offer')
      expect(result.error).toBe(
        "Cannot read properties of null (reading 'status')"
      )
    })

    test('should handle database errors from acceptOffer', async () => {
      // Arrange
      const error = new Error('Database connection failed')
      acceptOffer.mockRejectedValue(error)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accept-offer/SFI123456789`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toEqual({
        message: 'Failed to accept offer',
        error: 'Database connection failed'
      })
    })

    test('should handle missing agreement ID', async () => {
      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/accept-offer/',
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(result.message).toBeUndefined()
    })

    test('should handle base URL header', async () => {
      const agreementId = 'SFI123456789'

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accept-offer/${agreementId}`,
        headers: {
          'x-base-url': '/defra-grants-proxy',
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Offer accepted')
      expect(String(result)).toContain(agreementId)
      expect(String(result)).toContain('/defra-grants-proxy')
    })
  })

  describe('already accepted', () => {
    const agreementId = 'SFI123456789'

    beforeEach(() => {
      // Setup default mock implementations
      getAgreementDataById.mockResolvedValue({
        agreementNumber: agreementId,
        status: 'accepted',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      })
    })

    describe('POST', () => {
      test('should redirect to review offer', async () => {
        // Arrange
        const { statusCode, headers, result } = await server.inject({
          method: 'POST',
          url: `/accept-offer/${agreementId}`,
          headers: {
            'x-encrypted-auth': 'valid-jwt-token'
          }
        })

        // Assert
        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(`/offer-accepted/${agreementId}`)
        expect(result).toBe('')
      })

      test('should redirect to review offer when base URL is set', async () => {
        // Arrange
        const { statusCode, headers, result } = await server.inject({
          method: 'POST',
          url: `/accept-offer/${agreementId}`,
          headers: {
            'x-base-url': '/defra-grants-proxy',
            'x-encrypted-auth': 'valid-jwt-token'
          }
        })

        // Assert
        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          `/defra-grants-proxy/offer-accepted/${agreementId}`
        )
        expect(result).toBe('')
      })
    })

    describe('GET', () => {
      test('should return accepted offer page', async () => {
        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: `/offer-accepted/${agreementId}`,
          headers: {
            'x-encrypted-auth': 'valid-jwt-token'
          }
        })

        // Assert
        expect(statusCode).toBe(statusCodes.ok)
        expect(String(result)).toContain('Offer accepted')
      })

      test('should return accepted offer page when base URL is set', async () => {
        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: `/offer-accepted/${agreementId}`,
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

  describe('JWT Authorization', () => {
    beforeEach(() => {
      jest.clearAllMocks()

      // Setup default mock implementations
      getAgreementDataById.mockResolvedValue({
        agreementNumber: 'SFI123456789',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      })
      acceptOffer.mockResolvedValue()
      updatePaymentHub.mockResolvedValue()
    })

    test('Should return 401 when invalid JWT token provided', async () => {
      // Arrange
      jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(false)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/accept-offer/SFI123456789',
        headers: {
          'x-encrypted-auth': 'invalid-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toContain('<!DOCTYPE html>')
      expect(result).toContain('You are not authorized to access this page')
      expect(result).toContain(
        'Not authorized to accept offer agreement document'
      )
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
