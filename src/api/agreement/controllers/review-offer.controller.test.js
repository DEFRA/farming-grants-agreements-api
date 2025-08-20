import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'

// Mock the modules
jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  __esModule: true,
  ...jest.requireActual('~/src/api/agreement/helpers/get-agreement-data.js'),
  getAgreementDataById: jest.fn()
}))
jest.mock('~/src/api/agreement/helpers/get-agreement.js')
jest.mock('~/src/api/common/helpers/jwt-auth.js')

describe('reviewOfferController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

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

    // Setup default mock implementations
    jest.spyOn(agreementDataHelper, 'getAgreementDataById')

    // Mock JWT auth functions to return valid authorization by default
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(true)
  })

  describe('not yet accepted', () => {
    test('should return the rendered HTML offer document', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [
              {
                code: 'SFI1',
                area: 10.5
              }
            ]
          }
        ],
        actions: [
          {
            code: 'SFI1',
            title: 'Arable and Horticultural Soils'
          }
        ],
        payments: {
          activities: [
            {
              code: 'SFI1',
              description: 'Arable and Horticultural Soils',
              rate: 28,
              annualPayment: 294
            }
          ],
          totalAnnualPayment: 294
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, headers, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(headers['content-type']).toContain('text/html')
      expect(String(result)).toContain('Review your funding offer')
      expect(String(result)).toContain('£73.50')
      expect(String(result)).toContain('Arable and Horticultural Soils')
      expect(String(result)).toContain('SFI1')
    })

    test('should handle actions with missing action title and use activity code as fallback', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [
              {
                code: 'UNKNOWN_CODE',
                area: 5.0
              }
            ]
          }
        ],
        actions: [
          {
            code: 'SFI1',
            title: 'Arable and Horticultural Soils'
          }
        ],
        payments: {
          activities: [
            {
              code: 'SFI1',
              description: 'Arable and Horticultural Soils',
              rate: 28,
              annualPayment: 294
            }
          ],
          totalAnnualPayment: 294
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('UNKNOWN_CODE')
      expect(String(result)).toContain('PARCEL001')
    })

    test('should handle payments with missing description and use payment code as fallback', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [
              {
                code: 'SFI1',
                area: 10.5
              }
            ]
          }
        ],
        actions: [
          {
            code: 'SFI1',
            title: 'Arable and Horticultural Soils'
          }
        ],
        payments: {
          activities: [
            {
              code: 'SFI1',
              description: null, // Missing description
              rate: 28,
              annualPayment: 294
            }
          ],
          totalAnnualPayment: 294
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('SFI1') // Should use payment code as fallback
    })

    test('should handle empty parcels array', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [], // Empty parcels array
        actions: [],
        payments: {
          activities: [],
          totalAnnualPayment: 0
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Review your funding offer')
    })

    test('should handle parcels with empty activities array', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [] // Empty activities array
          }
        ],
        actions: [],
        payments: {
          activities: [],
          totalAnnualPayment: 0
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Review your funding offer')
    })

    test('should handle missing payments data', async () => {
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [
              {
                code: 'SFI1',
                area: 10.5
              }
            ]
          }
        ]
        // Missing actions object - this will test the optional chaining operator
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Review your funding offer')
    })

    test('should handle base URL header', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [],
        actions: [],
        payments: {
          activities: [],
          totalAnnualPayment: 0
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'x-base-url': '/defra-grants-proxy',
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Review your funding offer')
      expect(String(result)).toContain('/defra-grants-proxy')
    })

    test('should handle base URL header as false', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '123456789',
        parcels: [],
        actions: [],
        payments: {
          activities: [],
          totalAnnualPayment: 0
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'x-base-url': false,
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Review your funding offer')
    })

    test('should fail if theres an error reading the database', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const errorMessage = 'Failed to fetch agreement data'
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockImplementation(() => {
          throw new Error(errorMessage)
        })

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toEqual({
        message: 'Failed to fetch offer',
        error: errorMessage
      })
    })

    test('should fail if getAgreementDataById throws an error', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const errorMessage = 'Failed to generate HTML document'

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockRejectedValue(new Error(errorMessage))

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toEqual({
        message: 'Failed to fetch offer',
        error: errorMessage
      })
    })
  })

  describe('already accepted', () => {
    const agreementId = 'SFI123456789'

    beforeEach(() => {
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'accepted',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)
    })

    test('should redirect to review offer', async () => {
      // Arrange
      const { statusCode, headers, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`/offer-accepted/${agreementId}`)
      expect(result).toBe('')
    })

    test('should redirect to review offer when base URL is set', async () => {
      // Arrange
      const agreementId = 'SFI123456789'

      const { statusCode, headers, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'x-base-url': '/defra-grants-proxy'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/defra-grants-proxy/offer-accepted/${agreementId}`
      )
      expect(result).toBe('')
    })
  })

  describe('JWT Authorization', () => {
    beforeEach(() => {
      jest.clearAllMocks()

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue({
          sbi: '106284736',
          agreementNumber: 'SFI123456789'
        })
    })

    test('Should return 401 when invalid JWT token provided', async () => {
      jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(false)

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/review-offer/SFI123456789',
        headers: {
          'x-encrypted-auth': 'invalid-token'
        }
      })

      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toContain('<!DOCTYPE html>')
      expect(result).toContain('You are not authorized to access this page')
      expect(result).toContain(
        'Not authorized to review offer agreement document'
      )
    })
  })
})
