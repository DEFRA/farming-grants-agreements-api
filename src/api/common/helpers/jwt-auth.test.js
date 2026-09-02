import { validateJwtAuthentication } from './jwt-auth.js'
import Jwt from '@hapi/jwt'
import { config } from '#~/config/index.js'

vi.mock('@hapi/jwt')
vi.mock('#~/config/index.js')

describe('jwt-auth', () => {
  const mockLogger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }

  const mockAgreementData = {
    identifiers: { sbi: '123456' },
    agreementNumber: 'FPTT123456789'
  }

  const setupMockConfig = (isJwtEnabled = true, overrides = {}) => {
    config.get = vi.fn((key) => {
      if (key === 'featureFlags.isJwtEnabled') return isJwtEnabled
      if (key === 'jwtSecret') return 'mock-jwt-secret'
      if (key === 'jwtDefaultKid')
        return overrides.jwtDefaultKid ?? 'agreements-hs256-1'
      if (key === 'jwtKeyring') return overrides.jwtKeyring ?? ''
      return null
    })
  }

  const setupMockJwtWithHeader = (payload, header) => {
    const mockDecoded = { decoded: { header, payload } }
    Jwt.token.decode = vi.fn().mockReturnValue(mockDecoded)
    Jwt.token.verify = vi.fn().mockImplementation(() => Promise.resolve())
  }

  const setupMockJwt = (payload = null, throwError = null) => {
    if (throwError) {
      Jwt.token.decode = vi.fn().mockImplementation(() => {
        throw throwError
      })
      Jwt.token.verify = vi.fn()
      return
    }

    if (payload) {
      const mockDecoded = {
        decoded: {
          payload
        }
      }
      Jwt.token.decode = vi.fn().mockReturnValue(mockDecoded)
      Jwt.token.verify = vi.fn().mockImplementation(() => Promise.resolve())
    } else {
      Jwt.token.decode = vi.fn().mockReturnValue(null)
      Jwt.token.verify = vi.fn()
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setupMockConfig()
  })

  describe('validateJwtAuthentication', () => {
    test('should return {valid:true, source:null, sbi:null} when JWT feature flag is disabled', () => {
      setupMockConfig(false)

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

    test('should throw 400 when feature flag is disabled and no agreement data is provided', () => {
      setupMockConfig(false)

      expect(() => validateJwtAuthentication(null, null, mockLogger)).toThrow(
        /Bad request, Neither JWT is enabled nor agreementId is provided/i
      )
    })

    test('should throw 400 when feature flag is enabled and no token provided', () => {
      expect(() =>
        validateJwtAuthentication('', mockAgreementData, mockLogger)
      ).toThrow(
        /Bad request, JWT is enabled but no auth token provided in the header/i
      )
    })

    test('should return {valid:false, source:null, sbi:null} when JWT extraction fails (no token)', () => {
      setupMockJwt(null)

      const result = validateJwtAuthentication(
        'invalid-token',
        mockAgreementData,
        mockLogger
      )

      expect(result).toEqual({ valid: false, source: null, sbi: null })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'JWT payload extraction failed'
      )
    })

    test('should return {valid:false, source:null, sbi:null} when JWT verification fails', () => {
      const mockError = new Error('Invalid signature')
      setupMockJwt(null, mockError)

      const result = validateJwtAuthentication(
        'invalid-token',
        mockAgreementData,
        mockLogger
      )

      expect(result).toEqual({ valid: false, source: null, sbi: null })
      expect(mockLogger.error).toHaveBeenCalledWith(
        mockError,
        'Invalid JWT token provided: Invalid signature'
      )
    })

    describe('source and SBI validation logic', () => {
      test('should return true for entra source regardless of SBI', () => {
        setupMockJwt({ sbi: 'different-sbi', source: 'entra' })

        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )

        expect(result).toEqual({
          valid: true,
          source: 'entra',
          sbi: 'different-sbi'
        })
      })

      test('should return true for defra source with matching SBI', () => {
        setupMockJwt({ sbi: '123456', source: 'defra' })

        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )

        expect(result.valid).toBe(true)
        expect(result.source).toBe('defra')
        expect(result.sbi).toBe('123456')
      })

      test('should return false for defra source with non-matching SBI', () => {
        setupMockJwt({ sbi: 'different-sbi', source: 'defra' })

        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )

        expect(result.valid).toBe(false)
      })

      test('should return false for unknown source', () => {
        setupMockJwt({ sbi: '123456', source: 'unknown' })

        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )

        expect(result.valid).toBe(false)
      })

      test('should return true for defra when jwtSbi present and agreementSbi missing', () => {
        setupMockJwt({ sbi: '123456', source: 'defra' })
        const agreementData = { identifiers: {} }

        const result = validateJwtAuthentication(
          'token',
          agreementData,
          mockLogger
        )

        expect(result.valid).toBe(true)
      })

      test('should return true for defra when type mismatch (number vs string)', () => {
        setupMockJwt({ sbi: 123456, source: 'defra' })
        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )
        expect(result.valid).toBe(true)

        setupMockJwt({ sbi: '123456', source: 'defra' })
        const agreementData = { identifiers: { sbi: 123456 } }
        const result2 = validateJwtAuthentication(
          'token',
          agreementData,
          mockLogger
        )
        expect(result2.valid).toBe(true)
      })

      test('should return false for defra when jwtSbi is missing/empty/null', () => {
        const scenarios = [
          { sbi: undefined, source: 'defra' },
          { sbi: '', source: 'defra' },
          { sbi: null, source: 'defra' }
        ]

        scenarios.forEach((payload) => {
          setupMockJwt(payload)
          const result = validateJwtAuthentication(
            'token',
            mockAgreementData,
            mockLogger
          )
          expect(result.valid).toBe(false)
        })
      })

      test('should return true for defra when identifiers object missing', () => {
        setupMockJwt({ sbi: '123456', source: 'defra' })
        const agreementData = {}

        const result = validateJwtAuthentication(
          'token',
          agreementData,
          mockLogger
        )

        expect(result.valid).toBe(true)
      })

      test('should return true for defra when agreementData is null', () => {
        setupMockJwt({ sbi: '123456', source: 'defra' })

        const result = validateJwtAuthentication('token', null, mockLogger)

        expect(result.valid).toBe(true)
      })

      test('should return true for defra when jwtSbi is 0 (number) and agreementSbi missing', () => {
        setupMockJwt({ sbi: 0, source: 'defra' })
        const agreementData = { identifiers: {} }

        const result = validateJwtAuthentication(
          'token',
          agreementData,
          mockLogger
        )

        expect(result.valid).toBe(true)
      })
    })

    describe('kid key selection (FGP-1307)', () => {
      const validPayload = {
        iss: 'grants-ui',
        aud: ['agreements-api'],
        sub: '123456',
        sbi: '123456',
        source: 'defra'
      }

      test('uses the default secret when the token carries no kid', () => {
        setupMockJwtWithHeader(validPayload, {})

        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )

        expect(result.valid).toBe(true)
        expect(Jwt.token.verify).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ key: 'mock-jwt-secret' })
        )
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'JWT caller token carried no kid; using the default signing secret'
        )
      })

      test('uses the default secret when the kid matches the default kid', () => {
        setupMockJwtWithHeader(validPayload, { kid: 'agreements-hs256-1' })

        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )

        expect(result.valid).toBe(true)
        expect(Jwt.token.verify).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ key: 'mock-jwt-secret' })
        )
      })

      test('verifies a rotated kid using the keyring secret', () => {
        setupMockConfig(true, {
          jwtKeyring: JSON.stringify({ 'agreements-hs256-2': 'rotated-secret' })
        })
        setupMockJwtWithHeader(validPayload, { kid: 'agreements-hs256-2' })

        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )

        expect(result.valid).toBe(true)
        expect(Jwt.token.verify).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ key: 'rotated-secret' })
        )
      })

      test('rejects a token whose kid is not in the keyring', () => {
        setupMockJwtWithHeader(validPayload, { kid: 'unknown-kid' })

        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )

        expect(result).toEqual({ valid: false, source: null, sbi: null })
        expect(Jwt.token.verify).not.toHaveBeenCalled()
        expect(mockLogger.error).toHaveBeenCalledWith(
          { kid: 'unknown-kid' },
          'JWT caller token carried an unknown kid'
        )
      })

      test('treats a malformed keyring as empty and rejects an unknown kid', () => {
        setupMockConfig(true, { jwtKeyring: 'not-valid-json' })
        setupMockJwtWithHeader(validPayload, { kid: 'agreements-hs256-2' })

        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )

        expect(result).toEqual({ valid: false, source: null, sbi: null })
        expect(Jwt.token.verify).not.toHaveBeenCalled()
        expect(mockLogger.error).toHaveBeenCalledWith(
          { kid: 'agreements-hs256-2' },
          'JWT caller token carried an unknown kid'
        )
      })
    })

    describe('warn-only claim checks (FGP-1307)', () => {
      test('warns but accepts when the issuer is not allow-listed', () => {
        setupMockJwtWithHeader(
          {
            iss: 'someone-else',
            aud: ['agreements-api'],
            sbi: '123456',
            source: 'defra'
          },
          { kid: 'agreements-hs256-1' }
        )

        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )

        expect(result.valid).toBe(true)
        expect(mockLogger.warn).toHaveBeenCalledWith(
          { hasIss: true },
          'JWT caller token issuer is not in the allow-list; accepted for now'
        )
      })

      test('warns but accepts when the audience does not include this service', () => {
        setupMockJwtWithHeader(
          {
            iss: 'grants-ui',
            aud: ['agreements-ui', 'gas'],
            sbi: '123456',
            source: 'defra'
          },
          { kid: 'agreements-hs256-1' }
        )

        const result = validateJwtAuthentication(
          'token',
          mockAgreementData,
          mockLogger
        )

        expect(result.valid).toBe(true)
        expect(mockLogger.warn).toHaveBeenCalledWith(
          { hasAud: true },
          'JWT caller token audience does not include this service; accepted for now'
        )
      })

      test('does not warn when issuer and audience are valid', () => {
        setupMockJwtWithHeader(
          {
            iss: 'grants-ui',
            aud: ['agreements-api'],
            sbi: '123456',
            source: 'defra'
          },
          { kid: 'agreements-hs256-1' }
        )

        validateJwtAuthentication('token', mockAgreementData, mockLogger)

        expect(mockLogger.warn).not.toHaveBeenCalledWith(
          expect.anything(),
          'JWT caller token issuer is not in the allow-list; accepted for now'
        )
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
          expect.anything(),
          'JWT caller token audience does not include this service; accepted for now'
        )
      })
    })
  })
})
