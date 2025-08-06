import { extractJwtPayload, verifyJwtPayload } from './jwt-auth.js'
import Jwt from '@hapi/jwt'
import { config } from '~/src/config/index.js'

jest.mock('@hapi/jwt')
jest.mock('~/src/config/index.js')

describe('jwt-auth', () => {
  const mockLogger = {
    error: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    config.get = jest.fn().mockReturnValue('mock-jwt-secret')
  })

  describe('extractJwtPayload', () => {
    test('should return null when no token is provided', () => {
      const result = extractJwtPayload('', mockLogger)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith('No JWT token provided')
    })

    test('should return null when token is null', () => {
      const result = extractJwtPayload(null, mockLogger)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith('No JWT token provided')
    })

    test('should return payload when valid token is provided', () => {
      const mockPayload = { sbi: '123456', source: 'defra' }
      const mockDecoded = {
        decoded: {
          payload: mockPayload
        }
      }

      Jwt.token.decode = jest.fn().mockReturnValue(mockDecoded)
      Jwt.token.verify = jest.fn().mockImplementation(() => Promise.resolve())

      const result = extractJwtPayload('valid-token', mockLogger)

      expect(result).toEqual(mockPayload)
      expect(Jwt.token.decode).toHaveBeenCalledWith('valid-token')
      expect(Jwt.token.verify).toHaveBeenCalledWith(mockDecoded, {
        key: 'mock-jwt-secret',
        algorithms: ['HS256']
      })
    })

    test('should return null when JWT verification fails', () => {
      const mockDecoded = {
        decoded: {
          payload: { sbi: '123456', source: 'defra' }
        }
      }

      Jwt.token.decode = jest.fn().mockReturnValue(mockDecoded)
      Jwt.token.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const result = extractJwtPayload('invalid-token', mockLogger)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid JWT token provided: Invalid signature'
      )
    })
  })

  describe('verifyJwtPayload', () => {
    const mockAgreementData = {
      sbi: '123456',
      agreementNumber: 'SFI123456789'
    }

    test('should return true for entra source regardless of SBI', () => {
      const jwtPayload = {
        sbi: 'different-sbi',
        source: 'entra'
      }

      const result = verifyJwtPayload(jwtPayload, mockAgreementData)

      expect(result).toBe(true)
    })

    test('should return true for defra source with matching SBI', () => {
      const jwtPayload = {
        sbi: '123456',
        source: 'defra'
      }

      const result = verifyJwtPayload(jwtPayload, mockAgreementData)

      expect(result).toBe(true)
    })

    test('should return false for defra source with non-matching SBI', () => {
      const jwtPayload = {
        sbi: 'different-sbi',
        source: 'defra'
      }

      const result = verifyJwtPayload(jwtPayload, mockAgreementData)

      expect(result).toBe(false)
    })

    test('should return false for unknown source', () => {
      const jwtPayload = {
        sbi: '123456',
        source: 'unknown'
      }

      const result = verifyJwtPayload(jwtPayload, mockAgreementData)

      expect(result).toBe(false)
    })

    test('should return false when jwt payload is null', () => {
      const result = verifyJwtPayload(null, mockAgreementData)

      expect(result).toBe(false)
    })
  })
})
