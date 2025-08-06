import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
import * as getHTMLAgreement from '~/src/api/agreement/helpers/get-html-agreement.js'
import Jwt from '@hapi/jwt'

// Mock the modules
jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')
jest.mock('~/src/api/agreement/helpers/get-html-agreement.js')
jest.mock('@hapi/jwt')

describe('viewAgreementController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const mockRenderedHtml = `<html><body>Test HTML with SFI123456789</body></html>`
  const mockAgreementData = {
    sbi: '106284736',
    agreementNumber: 'SFI123456789'
  }

  beforeAll(async () => {
    server = await createServer({ disableSQS: true })
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()

    // Mock default successful responses for all tests
    jest
      .spyOn(agreementDataHelper, 'getAgreementData')
      .mockResolvedValue(mockAgreementData)

    jest
      .spyOn(getHTMLAgreement, 'getHTMLAgreementDocument')
      .mockResolvedValue(mockRenderedHtml)

    Jwt.token.verify = jest.fn().mockImplementation(() => Promise.resolve())

    // Mock JWT decode to return a valid Defra token by default
    Jwt.token.decode = jest.fn().mockReturnValue({
      decoded: {
        payload: {
          sbi: '106284736',
          source: 'defra'
        }
      }
    })
  })

  test('Should return HTML when valid agreement ID and valid auth are provided', async () => {
    // Arrange
    const agreementId = 'SFI123456789'

    // Act
    const { statusCode, headers, payload } = await server.inject({
      method: 'GET',
      url: `/view-agreement/${agreementId}`,
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(headers['content-type']).toContain('text/html')
    expect(payload).toBe(mockRenderedHtml)

    // Verify mocks were called correctly
    expect(agreementDataHelper.getAgreementData).toHaveBeenCalledWith({
      agreementNumber: agreementId
    })
    expect(getHTMLAgreement.getHTMLAgreementDocument).toHaveBeenCalledWith(
      agreementId,
      mockAgreementData,
      '/'
    )
  })

  test('Should handle missing agreement ID', async () => {
    // Act
    const { statusCode, headers, payload } = await server.inject({
      method: 'GET',
      url: '/view-agreement/undefined',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(headers['content-type']).toContain('text/html')
    expect(payload).toBe(mockRenderedHtml)

    // Verify the function defaulted to a reasonable value when ID was missing
    expect(agreementDataHelper.getAgreementData).toHaveBeenCalledWith({
      agreementNumber: 'undefined'
    })
  })

  test('Should handle error when template rendering fails', async () => {
    // Arrange
    const errorMessage = 'Failed to render HTML'
    jest
      .spyOn(getHTMLAgreement, 'getHTMLAgreementDocument')
      .mockRejectedValue(new Error(errorMessage))

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/view-agreement/SFI123456789',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to generate agreement document',
      error: errorMessage
    })
  })

  test('Should handle error when agreement data retrieval fails', async () => {
    // Arrange
    const errorMessage = 'Failed to render HTML'
    jest
      .spyOn(agreementDataHelper, 'getAgreementData')
      .mockImplementation(() => {
        throw new Error(errorMessage)
      })

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/view-agreement/SFI123456789'
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to generate agreement document',
      error: errorMessage
    })
  })

  // JWT Authorization Tests
  describe('JWT Authorization', () => {
    beforeEach(() => {
      jest.clearAllMocks()

      // Mock default successful responses
      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      jest
        .spyOn(getHTMLAgreement, 'getHTMLAgreementDocument')
        .mockResolvedValue(mockRenderedHtml)
    })

    test('Should return 401 when no JWT token provided', async () => {
      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/view-agreement/SFI123456789'
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to view offer agreement document'
      })
    })

    test('Should return 401 when invalid JWT token provided', async () => {
      // Arrange
      const mockDecodedToken = { decoded: { payload: null } }
      Jwt.token.decode = jest.fn().mockReturnValue(mockDecodedToken)
      Jwt.token.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token format')
      })

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/view-agreement/SFI123456789',
        headers: {
          'x-encrypted-auth': 'invalid-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to view offer agreement document'
      })
      expect(Jwt.token.decode).toHaveBeenCalledWith('invalid-token')
      expect(Jwt.token.verify).toHaveBeenCalledWith(mockDecodedToken, {
        key: expect.any(String),
        algorithms: ['HS256']
      })
    })

    test('Should authorize Entra users regardless of SBI match', async () => {
      // Arrange
      const mockDecodedToken = {
        decoded: {
          payload: {
            sbi: 'different-sbi',
            source: 'entra'
          }
        }
      }
      Jwt.token.decode = jest.fn().mockReturnValue(mockDecodedToken)
      Jwt.token.verify = jest.fn().mockImplementation(() => Promise.resolve())

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/view-agreement/SFI123456789',
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
    })

    test('Should authorize Defra users with matching SBI', async () => {
      // Arrange
      const mockDecodedToken = {
        decoded: {
          payload: {
            sbi: '106284736', // matches mockAgreementData.sbi
            source: 'defra'
          }
        }
      }
      Jwt.token.decode = jest.fn().mockReturnValue(mockDecodedToken)
      Jwt.token.verify = jest.fn().mockImplementation(() => Promise.resolve())

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/view-agreement/SFI123456789',
        headers: {
          'x-encrypted-auth': 'defra-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
    })

    test('Should return 401 for Defra users with non-matching SBI', async () => {
      // Arrange
      const mockDecodedToken = {
        decoded: {
          payload: {
            sbi: 'different-sbi',
            source: 'defra'
          }
        }
      }
      Jwt.token.decode = jest.fn().mockReturnValue(mockDecodedToken)
      Jwt.token.verify = jest.fn().mockImplementation(() => Promise.resolve())

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/view-agreement/SFI123456789',
        headers: {
          'x-encrypted-auth': 'defra-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to view offer agreement document'
      })
    })

    test('Should return 401 for unknown source type', async () => {
      // Arrange
      const mockDecodedToken = {
        decoded: {
          payload: {
            sbi: '106284736',
            source: 'unknown-source'
          }
        }
      }
      Jwt.token.decode = jest.fn().mockReturnValue(mockDecodedToken)
      Jwt.token.verify = jest.fn().mockImplementation(() => Promise.resolve())

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/view-agreement/SFI123456789',
        headers: {
          'x-encrypted-auth': 'unknown-source-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to view offer agreement document'
      })
    })

    test('Should return 401 when JWT payload is malformed', async () => {
      // Arrange
      const mockDecodedToken = {
        decoded: {
          payload: null
        }
      }
      Jwt.token.decode = jest.fn().mockReturnValue(mockDecodedToken)
      Jwt.token.verify = jest.fn().mockImplementation(() => Promise.resolve())

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/view-agreement/SFI123456789',
        headers: {
          'x-encrypted-auth': 'malformed-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: 'Not authorized to view offer agreement document'
      })
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
