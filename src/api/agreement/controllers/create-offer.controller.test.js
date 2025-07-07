import Boom from '@hapi/boom'
import { createServer } from '~/src/api/index.js'
import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'

jest.mock('~/src/api/agreement/helpers/create-offer.js')

describe('createOfferController', () => {
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

  test('successfully creates offer', async () => {
    createOffer.mockResolvedValue(true)

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/create-offer',
      payload: {
        agreementId: '123',
        data: 'test data'
      }
    })

    expect(createOffer).toHaveBeenCalledWith({
      agreementId: '123',
      data: 'test data'
    })
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual({
      message: 'Agreement created'
    })
  })

  test('throws error when no agreement data provided', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/create-offer',
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
      payload: {
        agreementId: '123',
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
      payload: {
        agreementId: '123',
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
})
