import {
  extractJwtPayload,
  validateJwtAuthentication,
  verifyJwtPayload
} from './jwt-auth.js'
import Jwt from '@hapi/jwt'
import { config } from '~/src/config/index.js'

jest.mock('@hapi/jwt')
jest.mock('~/src/config/index.js')

describe('jwt-auth', () => {
  const mockLogger = {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
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

      const mockError = new Error('Invalid signature')

      Jwt.token.decode = jest.fn().mockReturnValue(mockDecoded)
      Jwt.token.verify = jest.fn().mockImplementation(() => {
        throw mockError
      })

      const result = extractJwtPayload('invalid-token', mockLogger)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        mockError,
        'Invalid JWT token provided: Invalid signature'
      )
    })
  })

  describe('verifyJwtPayload', () => {
    const mockAgreementData = {
      identifiers: { sbi: '123456' },
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

    test('should return true for defra when jwtSbi present and agreementSbi missing', () => {
      const jwtPayload = { sbi: '123456', source: 'defra' }
      const agreementData = { identifiers: {} } // no sbi

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(true)
    })

    test('should return true for defra when jwtSbi is number and agreementSbi is string (matching)', () => {
      const jwtPayload = { sbi: 123456, source: 'defra' }
      const agreementData = { identifiers: { sbi: '123456' } }

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(true)
    })

    test('should return true for defra when jwtSbi is string and agreementSbi is number (matching)', () => {
      const jwtPayload = { sbi: '123456', source: 'defra' }
      const agreementData = { identifiers: { sbi: 123456 } }

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(true)
    })

    test('should return false for defra when jwtSbi is missing', () => {
      const jwtPayload = { source: 'defra' } // no sbi
      const agreementData = { identifiers: { sbi: '123456' } }

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(false)
    })

    test('should return true for defra when jwtSbi present and identifiers object missing', () => {
      const jwtPayload = { sbi: '123456', source: 'defra' }
      const agreementData = {} // no identifiers at all

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(true)
    })

    test('should return false for defra when jwtSbi is empty string, agreementSbi present', () => {
      const jwtPayload = { sbi: '', source: 'defra' }
      const agreementData = { identifiers: { sbi: '123456' } }

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(false)
    })

    test('should return false for defra when both jwtSbi and agreementSbi are not present', () => {
      const jwtPayload = { sbi: null, source: 'defra' }
      const agreementData = { identifiers: { sbi: null } }

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(false)
    })

    test('should return false for defra when both jwtSbi and agreementSbi are empty/absent', () => {
      const jwtPayload = { sbi: '', source: 'defra' }
      const agreementData = { identifiers: {} }

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(false)
    })

    test('should return false for defra when jwtSbi is null', () => {
      const jwtPayload = { sbi: null, source: 'defra' }
      const agreementData = { identifiers: { sbi: '123456' } }

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(false)
    })

    test('should return true for defra when agreementSbi is null and jwtSbi present', () => {
      const jwtPayload = { sbi: '123456', source: 'defra' }
      const agreementData = { identifiers: { sbi: null } }

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(true)
    })

    test('should return true for defra when agreementData is null and jwtSbi present', () => {
      const jwtPayload = { sbi: '123456', source: 'defra' }
      const agreementData = null // -> agreementSbi === null

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(true)
    })

    test('should return true for defra when agreementSbi is empty string and jwtSbi present', () => {
      const jwtPayload = { sbi: '123456', source: 'defra' }
      const agreementData = { identifiers: { sbi: '' } }

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(true)
    })

    test('should return true for defra when jwtSbi is 0 (number) and agreementSbi missing', () => {
      const jwtPayload = { sbi: 0, source: 'defra' }
      const agreementData = { identifiers: {} }

      const result = verifyJwtPayload(jwtPayload, agreementData)

      expect(result).toBe(true)
    })
  })

  describe('validateJwtAuthentication', () => {
    const mockAgreementData = {
      identifiers: { sbi: '123456' },
      agreementNumber: 'SFI123456789'
    }

    beforeEach(() => {
      jest.clearAllMocks()
      config.get = jest.fn().mockReturnValue('mock-jwt-secret')
    })

    test('should return {valid:true, source:null} when JWT feature flag is disabled', () => {
      config.get = jest.fn((key) => {
        if (key === 'featureFlags.isJwtEnabled') return false
        if (key === 'jwtSecret') return 'mock-jwt-secret'
        return 'mock-jwt-secret'
      })

      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      }

      // Act
      const result = validateJwtAuthentication(
        'any-token',
        mockAgreementData,
        mockLogger
      )

      expect(result).toEqual({
        valid: true,
        source: null,
        sbi: null
      })
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'JWT authentication is disabled via feature flag'
      )
    })

    test('should validate and return object when feature flag enabled and JWT is valid (defra)', () => {
      config.get = jest.fn((key) => {
        if (key === 'featureFlags.isJwtEnabled') return true
        if (key === 'jwtSecret') return 'mock-jwt-secret'
        return 'mock-jwt-secret'
      })

      const mockPayload = { sbi: '123456', source: 'defra' }
      const mockDecoded = {
        decoded: {
          payload: mockPayload
        }
      }

      Jwt.token.decode = jest.fn().mockReturnValue(mockDecoded)
      Jwt.token.verify = jest.fn().mockImplementation(() => Promise.resolve())

      const mockLogger = {
        info: jest.fn(),
        error: jest.fn()
      }

      const result = validateJwtAuthentication(
        'valid-token',
        mockAgreementData,
        mockLogger
      )

      expect(result).toEqual({
        valid: true,
        source: 'defra',
        sbi: '123456'
      })
    })

    test('should throw 400 when feature flag is disabled and neither agreement data is provided', () => {
      config.get = jest.fn((key) => {
        if (key === 'featureFlags.isJwtEnabled') return false
      })

      const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() }

      expect(() => validateJwtAuthentication(null, null, mockLogger)).toThrow(
        /Bad request, Neither JWT is enabled nor agreementId is provided/i
      )
    })

    test('should throw 400 when feature flag is enabled and no token provided', () => {
      config.get = jest.fn((key) => {
        if (key === 'featureFlags.isJwtEnabled') return true
      })

      const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() }

      expect(() =>
        validateJwtAuthentication('', mockAgreementData, mockLogger)
      ).toThrow(
        /Bad request, JWT is enabled but no auth token provided in the header/i
      )
    })

    test('should return {valid:true, source:"entra", sbi:<payload sbi>} for Entra users when feature flag is enabled', () => {
      config.get = jest.fn((key) => {
        if (key === 'featureFlags.isJwtEnabled') return true
        if (key === 'jwtSecret') return 'mock-jwt-secret'
        return 'mock-jwt-secret'
      })

      const mockPayload = { sbi: 'different-sbi', source: 'entra' }
      const mockDecoded = { decoded: { payload: mockPayload } }

      Jwt.token.decode = jest.fn().mockReturnValue(mockDecoded)
      Jwt.token.verify = jest.fn().mockImplementation(() => Promise.resolve())

      const mockLogger = { info: jest.fn(), error: jest.fn() }

      const result = validateJwtAuthentication(
        'valid-token',
        mockAgreementData,
        mockLogger
      )

      expect(result).toEqual({
        valid: true,
        source: 'entra',
        sbi: 'different-sbi'
      })
    })
  })
})
