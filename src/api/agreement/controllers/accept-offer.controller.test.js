import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'

jest.mock('~/src/api/agreement/helpers/accept-offer.js')
jest.mock('~/src/api/agreement/helpers/update-payment-hub.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')
jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')
jest.mock('~/src/api/common/helpers/jwt-auth.js')

describe('acceptOfferDocumentController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const mockRenderedHtml = `<!DOCTYPE html><html><body>Offer accepted</body></html>`

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
    getAgreementData.mockReset()
    updatePaymentHub.mockReset()
    renderTemplate.mockReset()

    // Setup default mock implementations
    getAgreementData.mockResolvedValue({
      agreementNumber: 'SFI123456789',
      company: 'Test Company',
      sbi: '106284736',
      username: 'Test User'
    })
    acceptOffer.mockResolvedValue()
    updatePaymentHub.mockResolvedValue()
    renderTemplate.mockReturnValue(mockRenderedHtml)

    // Mock JWT auth functions to return valid authorization by default
    jest.spyOn(jwtAuth, 'extractJwtPayload').mockReturnValue({
      sbi: '106284736',
      source: 'defra'
    })
    jest.spyOn(jwtAuth, 'verifyJwtPayload').mockReturnValue(true)
  })

  test('should successfully accept an offer and return 200 OK', async () => {
    const agreementId = 'SFI123456789'

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/accept-offer/${agreementId}`,
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(getAgreementData).toHaveBeenCalledWith({
      agreementNumber: agreementId
    })
    expect(acceptOffer).toHaveBeenCalledWith(agreementId)
    expect(updatePaymentHub).toHaveBeenCalled()
    expect(renderTemplate).toHaveBeenCalledWith(
      'views/offer-accepted.njk',
      expect.objectContaining({
        agreementNumber: agreementId,
        company: 'Test Company',
        sbi: '106284736',
        farmerName: 'Test User',
        grantsProxy: false
      })
    )
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toBe(mockRenderedHtml)
  })

  test('should handle agreement not found error', async () => {
    // Arrange
    const agreementId = 'invalid-agreement-id'
    getAgreementData.mockResolvedValue(null)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/accept-offer/${agreementId}`,
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.notFound)
    expect(result.message).toContain('Agreement not found with ID')
    expect(result.error).toBe('Not Found')
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
    expect(statusCode).toBe(statusCodes.badRequest)
    expect(result.message).toBe('Agreement ID is required')
  })

  test('should handle grants proxy header', async () => {
    const agreementId = 'SFI123456789'

    const { statusCode } = await server.inject({
      method: 'POST',
      url: `/accept-offer/${agreementId}`,
      headers: {
        'defra-grants-proxy': 'true',
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(renderTemplate).toHaveBeenCalledWith(
      'views/offer-accepted.njk',
      expect.objectContaining({
        grantsProxy: true
      })
    )
  })

  // JWT Authorization Tests
  describe('JWT Authorization', () => {
    beforeEach(() => {
      jest.clearAllMocks()

      // Setup default mock implementations
      getAgreementData.mockResolvedValue({
        agreementNumber: 'SFI123456789',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      })
      acceptOffer.mockResolvedValue()
      updatePaymentHub.mockResolvedValue()
      renderTemplate.mockReturnValue(mockRenderedHtml)
    })

    test('Should return 401 when no JWT token provided', async () => {
      // Arrange
      jest.spyOn(jwtAuth, 'extractJwtPayload').mockReturnValue(null)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/accept-offer/SFI123456789'
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to accept offer agreement document'
      })
    })

    test('Should return 401 when invalid JWT token provided', async () => {
      // Arrange
      jest.spyOn(jwtAuth, 'extractJwtPayload').mockReturnValue(null)

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
      expect(result).toEqual({
        message: 'Not authorized to accept offer agreement document'
      })
    })

    test('Should return 401 for Defra users with non-matching SBI', async () => {
      // Arrange
      jest.spyOn(jwtAuth, 'extractJwtPayload').mockReturnValue({
        sbi: 'different-sbi',
        source: 'defra'
      })
      jest.spyOn(jwtAuth, 'verifyJwtPayload').mockReturnValue(false)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/accept-offer/SFI123456789',
        headers: {
          'x-encrypted-auth': 'defra-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to accept offer agreement document'
      })
    })

    test('Should return 401 for unknown source type', async () => {
      // Arrange
      jest.spyOn(jwtAuth, 'extractJwtPayload').mockReturnValue({
        sbi: '106284736',
        source: 'unknown-source'
      })
      jest.spyOn(jwtAuth, 'verifyJwtPayload').mockReturnValue(false)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/accept-offer/SFI123456789',
        headers: {
          'x-encrypted-auth': 'unknown-source-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to accept offer agreement document'
      })
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
