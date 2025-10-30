import Boom from '@hapi/boom'

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

describe('getAgreementController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const doGet = (agreementId = 'SFI123456789', headers = {}) =>
    server.inject({
      method: 'GET',
      url: `/${agreementId}`,
      headers: { 'x-encrypted-auth': 'valid-jwt-token', ...headers }
    })

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
  })

  describe('Farmer', () => {
    const agreementId = 'SFI123456789'

    beforeEach(() => {
      jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
        valid: true,
        source: 'defra',
        sbi: '900000005'
      })
    })

    describe('not yet accepted', () => {
      beforeEach(() => {
        const mockAgreementData = {
          agreementNumber: agreementId,
          status: 'offered',
          sbi: '900000005',
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

      test('should return offered data', async () => {
        const { statusCode, result } = await doGet(agreementId)
        expect(statusCode).toBe(statusCodes.ok)
        expect(result.agreementData.status).toContain('offered')
      })

      test('should handle agreement not found', async () => {
        jest
          .spyOn(agreementDataHelper, 'getAgreementDataById')
          .mockRejectedValue(Boom.notFound('Agreement not found'))

        const { statusCode, result } = await doGet('INVALID123')
        expect(statusCode).toBe(404)
        expect(result.errorMessage).toContain('Agreement not found')
      })

      test('should handle database errors', async () => {
        const errorMessage = 'Database connection failed'
        jest
          .spyOn(agreementDataHelper, 'getAgreementDataById')
          .mockRejectedValue(new Error(errorMessage))

        const { statusCode, result } = await doGet(agreementId)
        expect(statusCode).toBe(statusCodes.internalServerError)
        expect(result.errorMessage).toContain('Database connection failed')
      })
    })

    describe('already accepted', () => {
      beforeEach(() => {
        const mockAgreementData = {
          agreementNumber: agreementId,
          status: 'accepted',
          sbi: '900000005',
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

      test('should return accepted data', async () => {
        const { statusCode, result } = await doGet(agreementId)
        expect(statusCode).toBe(statusCodes.ok)
        expect(result.agreementData.status).toContain('accepted')
      })

      test('should return accepted agreement data with base URL when already accepted', async () => {
        const { statusCode, result } = await doGet(agreementId, {
          'x-base-url': '/agreement'
        })
        expect(statusCode).toBe(statusCodes.ok)
        expect(result.agreementData.status).toContain('accepted')
      })
    })
  })

  describe('Case worker', () => {
    beforeEach(() => {
      jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
        valid: true,
        source: 'entra'
      })

      const mockAgreementData = {
        agreementNumber: 'SFI123456789',
        status: 'offered',
        sbi: '900000005',
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

    test('should handle agreement success', async () => {
      const { statusCode, result } = await doGet('SFI123456789')
      expect(statusCode).toBe(statusCodes.ok)
      expect(result.agreementData.status).toContain('offered')
    })
  })

  describe('already accepted', () => {
    const agreementId = 'SFI123456789'

    beforeEach(() => {
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'accepted',
        sbi: '900000005',
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

    test('should return accepted data', async () => {
      // Arrange
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/${agreementId}`,
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(result.agreementData.status).toContain('accepted')
    })

    test('should return accepted agreement data with base URL when already accepted', async () => {
      // Arrange
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/${agreementId}`,
        headers: {
          'x-base-url': '/agreement',
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(result.agreementData.status).toContain('accepted')
    })
  })
})
