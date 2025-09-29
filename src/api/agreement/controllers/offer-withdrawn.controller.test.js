import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import { offerWithdrawnController } from './offer-withdrawn.controller.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'

describe('offerWithdrawnController', () => {
  let mockRequest
  let mockH
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      error: jest.fn()
    }

    mockRequest = {
      logger: mockLogger
    }

    mockH = {
      view: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      code: jest.fn().mockReturnThis(),
      response: jest.fn().mockReturnThis()
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('should render offer withdrawn page with correct headers and status code', () => {
    // Act
    const result = offerWithdrawnController.handler(mockRequest, mockH)

    // Assert
    expect(mockH.view).toHaveBeenCalledWith('views/error/offer-withdrawn.njk')
    expect(mockH.header).toHaveBeenCalledWith(
      'Cache-Control',
      'no-cache, no-store, must-revalidate'
    )
    expect(mockH.code).toHaveBeenCalledWith(statusCodes.ok)
    expect(result).toBe(mockH)
  })

  test('should pass through Boom errors', () => {
    // Arrange
    const boomError = Boom.badRequest('Test boom error')
    boomError.isBoom = true
    mockH.view.mockImplementation(() => {
      throw boomError
    })

    // Act & Assert
    expect(() => {
      offerWithdrawnController.handler(mockRequest, mockH)
    }).toThrow(boomError)
  })

  test('should handle non-Boom errors gracefully', () => {
    // Arrange
    const error = new Error('Template rendering failed')
    mockH.view.mockImplementation(() => {
      throw error
    })

    // Act
    const result = offerWithdrawnController.handler(mockRequest, mockH)

    // Assert
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.any(Error),
      'Error displaying offer withdrawn page: Template rendering failed'
    )
    expect(mockH.response).toHaveBeenCalledWith({
      message: 'Failed to display offer withdrawn page',
      error: 'Template rendering failed'
    })
    expect(mockH.code).toHaveBeenCalledWith(statusCodes.internalServerError)
    expect(result).toBe(mockH)
  })

  test('should handle errors with undefined message', () => {
    // Arrange
    const error = new Error()
    error.message = undefined
    mockH.view.mockImplementation(() => {
      throw error
    })

    // Act
    const result = offerWithdrawnController.handler(mockRequest, mockH)

    // Assert
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.any(Error),
      'Error displaying offer withdrawn page: undefined'
    )
    expect(mockH.response).toHaveBeenCalledWith({
      message: 'Failed to display offer withdrawn page',
      error: undefined
    })
    expect(mockH.code).toHaveBeenCalledWith(statusCodes.internalServerError)
    expect(result).toBe(mockH)
  })
})
