import Boom from '@hapi/boom'
import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { unacceptOffer } from '~/src/api/agreement/helpers/unaccept-offer.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'

jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/unaccept-offer.js')
jest.mock('~/src/api/agreement/helpers/update-payment-hub.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')
jest.mock('~/src/api/common/helpers/jwt-auth.js')

describe('unacceptOfferController', () => {
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

    // Setup default mock implementations
    jest.spyOn(agreementDataHelper, 'getAgreementData').mockResolvedValue({
      agreementNumber: 'SFI123456789',
      sbi: '106284736'
    })

    // Mock JWT auth functions to return valid authorization by default
    jest.spyOn(jwtAuth, 'extractJwtPayload').mockReturnValue({
      sbi: '106284736',
      source: 'defra'
    })
    jest.spyOn(jwtAuth, 'verifyJwtPayload').mockReturnValue(true)
  })

  test('should successfully unaccept an agreement and return 200 OK', async () => {
    const agreementId = 'SFI123456789'

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/unaccept-offer/${agreementId}`,
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(unacceptOffer).toHaveBeenCalledWith('SFI123456789')
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual({
      message: 'Offer unaccepted'
    })
  })

  test('should handle agreement not found error', async () => {
    // Arrange
    const agreementId = 'invalid-agreement-id'

    unacceptOffer.mockRejectedValue(Boom.notFound('Offer not found'))

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/unaccept-offer/${agreementId}`,
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.notFound)
    expect(result).toEqual({
      message: 'Offer not found',
      error: 'Not Found',
      statusCode: statusCodes.notFound
    })
  })

  test('should handle database errors from acceptAgreement', async () => {
    // Arrange
    const error = new Error('Database connection failed')
    unacceptOffer.mockRejectedValue(error)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/unaccept-offer/valid-agreement-id`,
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to unaccept offer',
      error: 'Database connection failed'
    })
  })

  // JWT Authorization Tests
  describe('JWT Authorization', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      unacceptOffer.mockResolvedValue()
    })

    test('Should return 401 when no JWT token provided', async () => {
      // Arrange
      jest.spyOn(jwtAuth, 'extractJwtPayload').mockReturnValue(null)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/unaccept-offer/SFI123456789'
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to unaccept offer agreement document'
      })
    })

    test('Should return 401 when invalid JWT token provided', async () => {
      // Arrange
      jest.spyOn(jwtAuth, 'extractJwtPayload').mockReturnValue(null)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/unaccept-offer/SFI123456789',
        headers: {
          'x-encrypted-auth': 'invalid-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to unaccept offer agreement document'
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
        url: '/unaccept-offer/SFI123456789',
        headers: {
          'x-encrypted-auth': 'defra-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to unaccept offer agreement document'
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
        url: '/unaccept-offer/SFI123456789',
        headers: {
          'x-encrypted-auth': 'unknown-source-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to unaccept offer agreement document'
      })
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
