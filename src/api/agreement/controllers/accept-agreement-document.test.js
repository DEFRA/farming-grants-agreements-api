import { jest } from '@jest/globals'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptAgreement } from '~/src/api/agreement/helpers/accept-agreement-data.js'
import { acceptAgreementDocumentController } from './accept-agreement-document.js'
import Boom from '@hapi/boom'

jest.mock('~/src/api/agreement/helpers/accept-agreement-data.js')

describe('acceptAgreementDocumentController', () => {
  let mockRequest
  let mockH
  const mockResponse = {
    code: jest.fn().mockReturnThis()
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockRequest = {
      params: {
        agreementId: 'SFI123456789'
      },
      payload: {
        username: 'John Doe'
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    }

    mockH = {
      response: jest.fn().mockReturnValue(mockResponse)
    }

    acceptAgreement.mockReset()
  })

  test('should successfully accept an agreement and return 200 OK', async () => {
    // Arrange
    const mockAgreementResult = {
      acknowledged: true,
      modifiedCount: 1
    }
    acceptAgreement.mockResolvedValue(mockAgreementResult)

    // Act
    const result = await acceptAgreementDocumentController.handler(
      mockRequest,
      mockH
    )

    // Assert
    expect(acceptAgreement).toHaveBeenCalledWith(
      'SFI123456789',
      mockRequest.logger,
      'John Doe'
    )
    expect(mockH.response).toHaveBeenCalledWith({
      message: 'Agreement accepted'
    })
    expect(mockResponse.code).toHaveBeenCalledWith(statusCodes.ok)
    expect(result).toBe(mockResponse)
  })

  test('should handle missing agreementId parameter', async () => {
    // Arrange
    mockRequest.params = {}
    const error = new Error('Agreement ID is required')
    acceptAgreement.mockRejectedValue(error)

    // Act
    const result = await acceptAgreementDocumentController.handler(
      mockRequest,
      mockH
    )

    // Assert
    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      `Error accepting agreement document: ${error.message}`
    )
    expect(mockH.response).toHaveBeenCalledWith({
      message: 'Failed to accept agreement document',
      error: error.message
    })
    expect(mockResponse.code).toHaveBeenCalledWith(
      statusCodes.internalServerError
    )
    expect(result).toBe(mockResponse)
  })

  test('should handle missing username parameter', async () => {
    // Arrange
    mockRequest.payload = {}
    const error = new Error('Username is required')
    acceptAgreement.mockRejectedValue(error)

    // Act
    const result = await acceptAgreementDocumentController.handler(
      mockRequest,
      mockH
    )

    // Assert
    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      `Error accepting agreement document: ${error.message}`
    )
    expect(mockH.response).toHaveBeenCalledWith({
      message: 'Failed to accept agreement document',
      error: error.message
    })
    expect(mockResponse.code).toHaveBeenCalledWith(
      statusCodes.internalServerError
    )
    expect(result).toBe(mockResponse)
  })

  test('should handle agreement not found error', async () => {
    // Arrange
    const error = Boom.notFound('Agreement not found')
    acceptAgreement.mockRejectedValue(error)

    // Act
    const result = await acceptAgreementDocumentController.handler(
      mockRequest,
      mockH
    )

    // Assert
    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      `Error accepting agreement document: ${error.message}`
    )
    expect(mockH.response).toHaveBeenCalledWith({
      message: 'Failed to accept agreement document',
      error: error.message
    })
    expect(mockResponse.code).toHaveBeenCalledWith(
      statusCodes.internalServerError
    )
    expect(result).toBe(mockResponse)
  })

  test('should handle database errors from acceptAgreement', async () => {
    // Arrange
    const error = new Error('Database connection failed')
    acceptAgreement.mockRejectedValue(error)

    // Act
    const result = await acceptAgreementDocumentController.handler(
      mockRequest,
      mockH
    )

    // Assert
    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      `Error accepting agreement document: ${error.message}`
    )
    expect(mockH.response).toHaveBeenCalledWith({
      message: 'Failed to accept agreement document',
      error: error.message
    })
    expect(mockResponse.code).toHaveBeenCalledWith(
      statusCodes.internalServerError
    )
    expect(result).toBe(mockResponse)
  })

  test('should handle case where params is undefined', async () => {
    // Arrange
    mockRequest.params = undefined
    const error = new Error(
      "Cannot read properties of undefined (reading 'agreementId')"
    )
    acceptAgreement.mockRejectedValue(error)

    // Act
    const result = await acceptAgreementDocumentController.handler(
      mockRequest,
      mockH
    )

    // Assert
    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      `Error accepting agreement document: ${error.message}`
    )
    expect(mockH.response).toHaveBeenCalledWith({
      message: 'Failed to accept agreement document',
      error: error.message
    })
    expect(mockResponse.code).toHaveBeenCalledWith(
      statusCodes.internalServerError
    )
    expect(result).toBe(mockResponse)
  })
})
