import Boom from '@hapi/boom'
import { createAgreementDocumentController } from './create-agreement-document.js'
import { createAgreement } from '~/src/api/agreement/helpers/create-agreement.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'

jest.mock('~/src/api/agreement/helpers/create-agreement.js')

describe('createAgreementDocumentController', () => {
  const mockRequest = {
    payload: {
      agreementId: '123',
      data: 'test data'
    },
    logger: {
      info: jest.fn(),
      error: jest.fn()
    }
  }

  const mockH = {
    response: jest.fn().mockReturnThis(),
    code: jest.fn().mockReturnThis()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('successfully creates agreement document', async () => {
    createAgreement.mockResolvedValue(true)

    await createAgreementDocumentController.handler(mockRequest, mockH)

    expect(createAgreement).toHaveBeenCalledWith(mockRequest.payload)
    expect(mockRequest.logger.info).toHaveBeenCalledWith(
      `Creating agreement document with data: ${JSON.stringify(mockRequest.payload)}`
    )
    expect(mockH.response).toHaveBeenCalledWith({
      message: 'Agreement created'
    })
    expect(mockH.code).toHaveBeenCalledWith(statusCodes.ok)
  })

  test('throws error when no agreement data provided', async () => {
    const requestWithNoPayload = { ...mockRequest, payload: null }

    const response = await createAgreementDocumentController.handler(
      requestWithNoPayload,
      mockH
    )

    expect(response.isBoom).toBe(true)
    expect(response.output.statusCode).toBe(500)
    expect(response.message).toBe('Agreement data is required')
  })

  test('handles createAgreement failure', async () => {
    const testError = new Error('Test error')
    createAgreement.mockRejectedValue(testError)

    await createAgreementDocumentController.handler(mockRequest, mockH)

    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      `Error creating agreement document: Error: Test error`
    )
    expect(mockH.response).toHaveBeenCalledWith({
      message: 'Failed to create agreement document',
      error: 'Test error'
    })
    expect(mockH.code).toHaveBeenCalledWith(statusCodes.internalServerError)
  })

  test('passes through Boom errors', async () => {
    const boomError = Boom.badRequest('Test Boom error')
    createAgreement.mockRejectedValue(boomError)

    const response = await createAgreementDocumentController.handler(
      mockRequest,
      mockH
    )

    expect(response).toBe(boomError)
  })
})
