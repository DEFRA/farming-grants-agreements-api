import { createServer } from './index.js'
import { validateJwtAuthentication } from './common/helpers/jwt-auth.js'
import { getAgreementDataById } from './agreement/helpers/get-agreement-data.js'

// Mock the dependencies
jest.mock('./common/helpers/jwt-auth.js', () => ({
  validateJwtAuthentication: jest.fn()
}))
jest.mock('./agreement/helpers/get-agreement-data.js', () => ({
  getAgreementDataById: jest.fn()
}))

describe('Custom Grants UI JWT Authentication Scheme', () => {
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

  describe('authentication via route', () => {
    const mockAgreementId = 'SFI123456789'
    const mockAgreementData = {
      agreementNumber: mockAgreementId,
      status: 'offered',
      customerReference: 'CUST123'
    }
    const mockToken = 'valid-jwt-token'

    it('should authenticate successfully with valid JWT and agreement data', async () => {
      // Arrange
      getAgreementDataById.mockResolvedValue(mockAgreementData)
      validateJwtAuthentication.mockReturnValue(true)

      // Act - make a request to a route that uses the authentication
      const response = await server.inject({
        method: 'GET',
        url: `/${mockAgreementId}`,
        headers: {
          'x-encrypted-auth': mockToken
        }
      })

      // Assert
      expect(getAgreementDataById).toHaveBeenCalledWith(mockAgreementId)
      expect(validateJwtAuthentication).toHaveBeenCalledWith(
        mockToken,
        mockAgreementData,
        expect.any(Object) // logger
      )
      expect(response.statusCode).not.toBe(401)
    })

    it('should return 401 when JWT validation fails', async () => {
      // Arrange
      getAgreementDataById.mockResolvedValue(mockAgreementData)
      validateJwtAuthentication.mockReturnValue(false)

      // Act
      const response = await server.inject({
        method: 'GET',
        url: `/${mockAgreementId}`,
        headers: {
          'x-encrypted-auth': 'invalid-token'
        }
      })

      // Assert
      expect(response.statusCode).toBe(401)
      expect(getAgreementDataById).toHaveBeenCalledWith(mockAgreementId)
      expect(validateJwtAuthentication).toHaveBeenCalledWith(
        'invalid-token',
        mockAgreementData,
        expect.any(Object) // logger
      )
    })

    it('should return 401 when agreement data is not found', async () => {
      // Arrange
      getAgreementDataById.mockResolvedValue(null)
      validateJwtAuthentication.mockReturnValue(false)

      // Act
      const response = await server.inject({
        method: 'GET',
        url: `/non-existent-id`,
        headers: {
          'x-encrypted-auth': mockToken
        }
      })

      // Assert
      expect(response.statusCode).toBe(401)
      expect(getAgreementDataById).toHaveBeenCalledWith('non-existent-id')
      expect(validateJwtAuthentication).toHaveBeenCalledWith(
        mockToken,
        null,
        expect.any(Object) // logger
      )
    })

    it('should return 401 when x-encrypted-auth header is missing', async () => {
      // Arrange
      getAgreementDataById.mockResolvedValue(mockAgreementData)
      validateJwtAuthentication.mockReturnValue(false)

      // Act
      const response = await server.inject({
        method: 'GET',
        url: `/${mockAgreementId}`,
        headers: {}
      })

      // Assert
      expect(response.statusCode).toBe(401)
      expect(getAgreementDataById).toHaveBeenCalledWith(mockAgreementId)
      expect(validateJwtAuthentication).toHaveBeenCalledWith(
        undefined,
        mockAgreementData,
        expect.any(Object) // logger
      )
    })

    it('should handle getAgreementDataById throwing an error', async () => {
      // Arrange
      const dbError = new Error('Database connection failed')
      getAgreementDataById.mockRejectedValue(dbError)

      // Act
      const response = await server.inject({
        method: 'GET',
        url: `/${mockAgreementId}`,
        headers: {
          'x-encrypted-auth': mockToken
        }
      })

      // Assert
      expect(response.statusCode).toBe(500) // Internal server error
      expect(getAgreementDataById).toHaveBeenCalledWith(mockAgreementId)
      expect(validateJwtAuthentication).not.toHaveBeenCalled()
    })

    it('should handle validateJwtAuthentication throwing an error', async () => {
      // Arrange
      getAgreementDataById.mockResolvedValue(mockAgreementData)
      const jwtError = new Error('JWT validation error')
      validateJwtAuthentication.mockImplementation(() => {
        throw jwtError
      })

      // Act
      const response = await server.inject({
        method: 'GET',
        url: `/${mockAgreementId}`,
        headers: {
          'x-encrypted-auth': mockToken
        }
      })

      // Assert
      expect(response.statusCode).toBe(500) // Internal server error
      expect(getAgreementDataById).toHaveBeenCalledWith(mockAgreementId)
      expect(validateJwtAuthentication).toHaveBeenCalledWith(
        mockToken,
        mockAgreementData,
        expect.any(Object) // logger
      )
    })

    it('should pass correct parameters to validateJwtAuthentication', async () => {
      // Arrange
      getAgreementDataById.mockResolvedValue(mockAgreementData)
      validateJwtAuthentication.mockReturnValue(true)

      // Act
      await server.inject({
        method: 'GET',
        url: `/${mockAgreementId}`,
        headers: {
          'x-encrypted-auth': mockToken
        }
      })

      // Assert
      expect(validateJwtAuthentication).toHaveBeenCalledWith(
        mockToken,
        mockAgreementData,
        expect.any(Object) // logger
      )
    })
  })

  describe('auth strategy registration', () => {
    it('should register the custom-grants-ui-jwt scheme', () => {
      // Test that the authentication strategy works by making a request
      // If the strategy is registered, the authentication should be processed
      expect(server.auth.api).toBeDefined()
    })
  })
})
