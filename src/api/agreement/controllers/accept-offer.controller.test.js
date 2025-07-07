import Boom from '@hapi/boom'
import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'

jest.mock('~/src/api/agreement/helpers/accept-offer.js')
jest.mock('~/src/api/agreement/helpers/update-payment-hub.js')

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
  })

  test('should successfully accept an offer and return 200 OK', async () => {
    const agreementId = 'SFI123456789'

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/accept-offer/${agreementId}`
    })

    // Assert
    expect(acceptOffer).toHaveBeenCalledWith(agreementId)
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Offer accepted')
  })

  test('should handle offer not found error', async () => {
    // Arrange
    const agreementId = 'invalid-agreement-id'

    acceptOffer.mockRejectedValue(Boom.notFound('Offer not found'))

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/accept-offer/${agreementId}`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.notFound)
    expect(result).toEqual({
      message: 'Offer not found',
      error: 'Not Found',
      statusCode: statusCodes.notFound
    })
  })

  test('should handle database errors from acceptOffer', async () => {
    // Arrange
    const error = new Error('Database connection failed')
    acceptOffer.mockRejectedValue(error)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/accept-offer/valid-agreement-id`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to accept offer',
      error: 'Database connection failed'
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
