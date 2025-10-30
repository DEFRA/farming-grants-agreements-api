import { createServer } from './index.js'
import { validateJwtAuthentication } from './common/helpers/jwt-auth.js'
import { getAgreementDataById } from './agreement/helpers/get-agreement-data.js'
import { Decimal128 } from 'mongodb'

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
    if (server) {
      await server.stop({ timeout: 0 })
    }
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
      validateJwtAuthentication.mockReturnValue({
        valid: true,
        source: 'defra',
        sbi: '123456'
      })

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
      validateJwtAuthentication.mockReturnValue({
        valid: true,
        source: 'defra',
        sbi: '123456'
      })

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

  describe('return-data-handler convertDecimal128', () => {
    beforeAll(() => {
      server.route({
        method: 'GET',
        path: '/__test/decimal',
        handler: () => ({
          a: Decimal128.fromString('1.23'),
          b: { c: Decimal128.fromString('4.56'), d: 'x' },
          e: [
            Decimal128.fromString('7.89'),
            { f: Decimal128.fromString('0.12') }
          ],
          n: null,
          p: 42
        })
      })

      server.route({
        method: 'GET',
        path: '/__test/decimal-array',
        handler: () => [
          Decimal128.fromString('10.01'),
          Decimal128.fromString('0'),
          Decimal128.fromString('999999.9999')
        ]
      })

      // Shared reference to trigger seen.has branch without circular structure
      server.route({
        method: 'GET',
        path: '/__test/decimal-shared',
        handler: () => {
          const shared = { value: Decimal128.fromString('3.14') }
          return {
            first: shared,
            second: shared,
            arr: [shared, shared]
          }
        }
      })

      // Null coverage in nested structures and arrays
      server.route({
        method: 'GET',
        path: '/__test/nulls',
        handler: () => ({
          top: null,
          inner: { n: null, d: Decimal128.fromString('2.5') },
          list: [null, Decimal128.fromString('1.5'), { x: null }]
        })
      })
    })

    it('converts Decimal128 values to numbers in nested objects and arrays', async () => {
      const res = await server.inject({ method: 'GET', url: '/__test/decimal' })
      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({
        a: 1.23,
        b: { c: 4.56, d: 'x' },
        e: [7.89, { f: 0.12 }],
        n: null,
        p: 42
      })
    })

    it('converts Decimal128 values inside arrays', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/__test/decimal-array'
      })
      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual([10.01, 0, 999999.9999])
    })

    it('handles shared object references (seen.has) and converts values once', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/__test/decimal-shared'
      })
      expect(res.statusCode).toBe(200)
      // Both paths point to the same object during conversion; value should be converted to number
      expect(res.result.first.value).toBe(3.14)
      expect(res.result.second.value).toBe(3.14)
      expect(res.result.arr[0].value).toBe(3.14)
      expect(res.result.arr[1].value).toBe(3.14)
    })

    it('returns nulls unchanged and converts Decimal128 alongside them', async () => {
      const res = await server.inject({ method: 'GET', url: '/__test/nulls' })
      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({
        top: null,
        inner: { n: null, d: 2.5 },
        list: [null, 1.5, { x: null }]
      })
    })
  })
})
