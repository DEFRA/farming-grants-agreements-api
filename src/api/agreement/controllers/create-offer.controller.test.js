import Boom from '@hapi/boom'
import { createServer } from '~/src/api/index.js'
import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'

jest.mock('~/src/api/agreement/helpers/create-offer.js')
jest.mock('~/src/api/common/helpers/jwt-auth.js')

describe('createOfferController', () => {
  let server
  let mockLogger

  beforeAll(async () => {
    server = await createServer({ disableSQS: true })
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock JWT auth functions to return valid authorization by default
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(true)

    // Patch request.logger to use mockLogger
    mockLogger = { info: jest.fn(), error: jest.fn() }
    server.ext('onRequest', (request, h) => {
      request.logger = mockLogger
      return h.continue
    })
  })

  test('successfully creates offer', async () => {
    createOffer.mockResolvedValue(true)

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/create-offer',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      },
      payload: {
        agreementId: '123',
        sbi: '106284736',
        data: 'test data'
      }
    })

    expect(createOffer).toHaveBeenCalledWith(
      {
        agreementId: '123',
        sbi: '106284736',
        data: 'test data'
      },
      mockLogger
    )
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual({
      message: 'Agreement created'
    })
  })

  test('throws error when no agreement data provided', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/create-offer',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      },
      payload: null
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'An internal server error occurred',
      error: 'Internal Server Error',
      statusCode: statusCodes.internalServerError
    })
  })

  test('handles createOffer failure', async () => {
    const testError = new Error('Test error')
    createOffer.mockRejectedValue(testError)

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/create-offer',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      },
      payload: {
        agreementId: '123',
        sbi: '106284736',
        data: 'test data'
      }
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to create agreement document',
      error: 'Test error'
    })
  })

  test('passes through Boom errors', async () => {
    const boomError = Boom.badRequest('Test Boom error')
    createOffer.mockRejectedValue(boomError)

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/create-offer',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      },
      payload: {
        agreementId: '123',
        sbi: '106284736',
        data: 'test data'
      }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(result).toEqual({
      message: 'Test Boom error',
      error: 'Bad Request',
      statusCode: statusCodes.badRequest
    })
  })

  // JWT Authorization Tests
  describe('JWT Authorization', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      createOffer.mockResolvedValue(true)
    })

    test('Should return 401 when invalid JWT token provided', async () => {
      // Arrange
      jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(false)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/create-offer',
        headers: {
          'x-encrypted-auth': 'invalid-token'
        },
        payload: {
          agreementId: '123',
          sbi: '106284736',
          data: 'test data'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to create offer agreement document'
      })
    })
  })
})
