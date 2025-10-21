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
jest.mock('~/src/api/common/helpers/jwt-auth.js')

describe('displayAcceptOfferController', () => {
  /** @type {import('@hapi/hapi').Server} */
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
    // Reset mocks before each test
    jest.clearAllMocks()

    // Setup default mock implementations
    jest.spyOn(agreementDataHelper, 'getAgreementDataById')
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(true)
  })

  describe('not yet accepted', () => {
    test('should return the rendered HTML accept offer page', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, headers, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'display-accept'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(headers['content-type']).toContain(
        'application/json; charset=utf-8'
      )
      expect(result.agreement.status).toContain('offered')
    })

    test('should handle agreement not found', async () => {
      const agreementId = 'INVALID123'
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(null)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'display-accept'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(500)
      expect(result.errorMessage).toContain('Cannot read properties of null')
    })

    test('should handle base URL header', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'display-accept'
        },
        headers: {
          'x-base-url': '/agreement',
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(result.agreement.status).toContain('offered')
    })

    test('should handle database errors', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const errorMessage = 'Database connection failed'
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockRejectedValue(new Error(errorMessage))

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'display-accept'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result.errorMessage).toContain('Database connection failed')
    })
  })

  describe('already accepted', () => {
    const agreementId = 'SFI123456789'

    beforeEach(() => {
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'accepted',
        sbi: '106284736',
        payment: {
          agreementStartDate: '2025-12-05',
          annualTotalPence: 0,
          parcelItems: {},
          agreementLevelItems: {}
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)
    })

    test('should render accept offer page even when already accepted', async () => {
      // Arrange
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'accept-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(result.agreement.status).toContain('accepted')
    })

    test('should render accept offer page with base URL when already accepted', async () => {
      // Arrange
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'accept-offer'
        },
        headers: {
          'x-base-url': '/agreement',
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(result.agreement.status).toContain('accepted')
    })
  })
})
