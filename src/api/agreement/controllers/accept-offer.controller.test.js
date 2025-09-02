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
        url: `/${agreementId}`,
        payload: {
          action: 'accept-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(getAgreementDataById).toHaveBeenCalledWith(agreementId)
      expect(acceptOffer).toHaveBeenCalledWith(
        agreementId,
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
        url: `/${agreementId}`,
        payload: {
          action: 'accept-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(500)
      expect(String(result)).toContain('Cannot read properties of null')
    })

    test('should handle database errors from acceptOffer', async () => {
      // Arrange
      const error = new Error('Database connection failed')
      acceptOffer.mockRejectedValue(error)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/SFI123456789`,
        payload: {
          action: 'accept-offer'
        },
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
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/',
        payload: {
          action: 'accept-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.notFound)
    })

    test('should handle base URL header', async () => {
      const agreementId = 'SFI123456789'

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
      expect(String(result)).toContain(agreementId)
      expect(String(result)).toContain('/defra-grants-proxy')
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
