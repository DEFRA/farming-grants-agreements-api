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
      auth: {
        credentials: {
          agreementData: 'mock'
        }
      },
      logger: mockLogger
    }

    mockH = {
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
    expect(mockH.response).toHaveBeenCalledWith({ agreementData: 'mock' })
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
    mockH.response.mockImplementation(() => {
      throw boomError
    })

    // Act & Assert
    expect(() => {
      offerWithdrawnController.handler(mockRequest, mockH)
    }).toThrow(boomError)
  })
})
