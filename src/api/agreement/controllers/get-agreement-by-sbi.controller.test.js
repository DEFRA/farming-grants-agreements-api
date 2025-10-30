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
  getAgreementDataBySbi: jest.fn()
}))
jest.mock('~/src/api/common/helpers/jwt-auth.js')

describe('getAgreementBySbiController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const doGet = () =>
    server.inject({
      method: 'GET',
      url: '/',
      headers: { 'x-encrypted-auth': 'valid-jwt-token' }
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
    jest.clearAllMocks()
    jest.spyOn(agreementDataHelper, 'getAgreementDataBySbi')
  })

  describe('Farmer', () => {
    beforeEach(() => {
      jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
        valid: true,
        source: 'defra',
        sbi: '106284736'
      })
    })

    describe('not yet accepted', () => {
      const agreementId = 'SFI123456789'

      beforeEach(() => {
        const mockAgreementData = {
          agreementNumber: agreementId,
          status: 'offered',
          sbi: '106284736',
          payment: {
            agreementStartDate: '2025-12-05',
            annualTotalPence: 0,
            parcelItems: {},
            agreementLevelItems: {}
          }
        }

        jest
          .spyOn(agreementDataHelper, 'getAgreementDataBySbi')
          .mockResolvedValue(mockAgreementData)
      })

      test('should return offered data', async () => {
        const { statusCode, result } = await doGet()
        expect(statusCode).toBe(statusCodes.ok)
        expect(result.agreementData.status).toContain('offered')
      })

      test('should handle agreement not found', async () => {
        jest
          .spyOn(agreementDataHelper, 'getAgreementDataBySbi')
          .mockRejectedValue(Boom.notFound('Agreement not found'))

        const { statusCode, result } = await doGet()
        expect(statusCode).toBe(404)
        expect(result.errorMessage).toContain('Agreement not found')
      })

      test('should handle database errors', async () => {
        const errorMessage = 'Database connection failed'
        jest
          .spyOn(agreementDataHelper, 'getAgreementDataBySbi')
          .mockRejectedValue(new Error(errorMessage))

        const { statusCode, result } = await doGet()
        expect(statusCode).toBe(statusCodes.internalServerError)
        expect(result.errorMessage).toContain('Database connection failed')
      })
    })

    describe('already accepted', () => {
      beforeEach(() => {
        const mockAgreementData = {
          agreementNumber: 'SFI123456789',
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
          .spyOn(agreementDataHelper, 'getAgreementDataBySbi')
          .mockResolvedValue(mockAgreementData)
      })

      test('should return accepted data', async () => {
        const { statusCode, result } = await doGet()
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
        sbi: '106284736',
        payment: {
          agreementStartDate: '2025-12-05',
          annualTotalPence: 0,
          parcelItems: {},
          agreementLevelItems: {}
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataBySbi')
        .mockResolvedValue(mockAgreementData)
    })

    test('should handle agreement forbidden', async () => {
      const { statusCode, result } = await doGet()
      expect(statusCode).toBe(401)
      expect(result.errorMessage).toContain(
        'Not allowed to view the agreement. Source: entra'
      )
    })
  })
})
