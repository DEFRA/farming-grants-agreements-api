import Boom from '@hapi/boom'
import hapi from '@hapi/hapi'
import { unacceptOffer } from '~/src/api/agreement/helpers/unaccept-offer.js'
import { testEndpoints } from '~/src/api/test-endpoints/index.js'

// Mock config
jest.mock('~/src/config/index.js', () => ({
  get: jest.fn().mockImplementation((key) => {
    if (key === 'featureFlags.testEndpoints') return true
    if (key === 'port') return 0
    return ''
  })
}))

jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/unaccept-offer.js')
jest.mock('~/src/api/agreement/helpers/update-payment-hub.js')

describe('unacceptOfferController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  beforeAll(async () => {
    // Create a test server with just the test endpoints
    server = hapi.server({
      port: 0
    })

    // Register the test endpoints plugin and initialize server
    testEndpoints.plugin.register(server)
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should successfully unaccept an agreement and return 200 OK', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    unacceptOffer.mockResolvedValue({ modifiedCount: 1 })

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/api/test/unaccept-offer/${agreementId}`
    })

    // Assert
    expect(unacceptOffer).toHaveBeenCalledWith(agreementId, { all: true })
    expect(statusCode).toBe(200)
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
      url: `/api/test/unaccept-offer/${agreementId}`
    })

    // Assert
    expect(statusCode).toBe(404)
    expect(result.statusCode).toBe(404)
    expect(result.error).toBe('Not Found')
  })

  test('should handle database errors from unacceptOffer', async () => {
    // Arrange
    unacceptOffer.mockRejectedValue(Boom.internal('Database connection failed'))

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/api/test/unaccept-offer/valid-agreement-id'
    })

    // Assert
    expect(statusCode).toBe(500)
    expect(result).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An internal server error occurred'
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
