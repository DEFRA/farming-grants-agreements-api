import Boom from '@hapi/boom'
import { createServer } from '~/src/api/index.js'
import { createAgreement } from '~/src/api/agreement/helpers/create-agreement.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'

jest.mock('~/src/api/agreement/helpers/create-agreement.js')

describe('createAgreementDocumentController', () => {
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

  test('successfully creates agreement document', async () => {
    createAgreement.mockResolvedValue(true)

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/api/agreement',
      payload: {
        agreementId: '123',
        data: 'test data'
      }
    })

    expect(createAgreement).toHaveBeenCalledWith({
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
      url: '/api/agreement',
      payload: null
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'An internal server error occurred',
      error: 'Internal Server Error',
      statusCode: statusCodes.internalServerError
    })
  })

  test('handles createAgreement failure', async () => {
    const testError = new Error('Test error')
    createAgreement.mockRejectedValue(testError)

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/api/agreement',
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
    createAgreement.mockRejectedValue(boomError)

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/api/agreement',
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
