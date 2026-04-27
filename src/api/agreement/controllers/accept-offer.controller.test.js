import { vi } from 'vitest'
import { createServer } from '#~/api/index.js'
import { statusCodes } from '#~/api/common/constants/status-codes.js'
import * as jwtAuth from '#~/api/common/helpers/jwt-auth.js'
import * as acceptOfferHelper from '#~/api/agreement/helpers/accept-offer.js'
import * as agreementDataHelper from '#~/api/agreement/helpers/get-agreement-data.js'

vi.mock('#~/api/common/helpers/sqs-client.js')
vi.mock('#~/api/common/helpers/jwt-auth.js')
vi.mock('#~/api/agreement/helpers/accept-offer.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { __esModule: true, ...actual, acceptOffer: vi.fn() }
})
vi.mock(
  '#~/api/agreement/helpers/get-agreement-data.js',
  async (importOriginal) => {
    const actual = await importOriginal()
    return { __esModule: true, ...actual, getAgreementDataBySbi: vi.fn() }
  }
)

describe('POST / - acceptOfferController', () => {
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
    vi.clearAllMocks()
    vi.spyOn(agreementDataHelper, 'getAgreementDataBySbi')
  })

  const doPost = () =>
    server.inject({
      method: 'POST',
      url: '/',
      headers: { 'x-encrypted-auth': 'valid-jwt-token' }
    })

  describe('when agreement status is offered', () => {
    const mockAgreementData = {
      agreementNumber: 'FPTT123456789',
      status: 'offered',
      sbi: '106284736',
      application: { parcel: [] }
    }

    beforeEach(() => {
      vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
        valid: true,
        source: 'defra',
        sbi: '106284736'
      })
      vi.spyOn(agreementDataHelper, 'getAgreementDataBySbi').mockResolvedValue(
        mockAgreementData
      )
    })

    test('should call acceptOffer and return updated agreement data', async () => {
      const mockAcceptedData = {
        agreementNumber: 'FPTT123456789',
        status: 'accepted',
        sbi: '106284736',
        claimId: 'test-claim-id',
        signatureDate: '2024-01-01T00:00:00.000Z'
      }

      vi.spyOn(acceptOfferHelper, 'acceptOffer').mockResolvedValue(
        mockAcceptedData
      )

      const { statusCode, result } = await doPost()

      expect(statusCode).toBe(statusCodes.ok)
      expect(acceptOfferHelper.acceptOffer).toHaveBeenCalledWith(
        'FPTT123456789',
        expect.objectContaining({ status: 'offered', sbi: '106284736' }),
        expect.any(Object),
        expect.any(Object)
      )
      expect(result.agreementData).toEqual(mockAcceptedData)
    })

    test('should handle errors from acceptOffer', async () => {
      vi.spyOn(acceptOfferHelper, 'acceptOffer').mockRejectedValue(
        new Error('Database connection failed')
      )

      const { statusCode, result } = await doPost()

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result.errorMessage).toContain('Database connection failed')
    })
  })

  describe('when agreement status is already accepted', () => {
    const mockAgreementData = {
      agreementNumber: 'FPTT123456789',
      status: 'accepted',
      sbi: '106284736',
      claimId: 'existing-claim-id',
      signatureDate: '2024-01-01T00:00:00.000Z'
    }

    beforeEach(() => {
      vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
        valid: true,
        source: 'defra',
        sbi: '106284736'
      })
      vi.spyOn(agreementDataHelper, 'getAgreementDataBySbi').mockResolvedValue(
        mockAgreementData
      )
    })

    test('should not call acceptOffer and return existing agreement data', async () => {
      const { statusCode, result } = await doPost()

      expect(statusCode).toBe(statusCodes.ok)
      expect(acceptOfferHelper.acceptOffer).not.toHaveBeenCalled()
      expect(result.agreementData.status).toBe('accepted')
      expect(result.agreementData.claimId).toBe('existing-claim-id')
    })
  })

  describe('when agreement status is withdrawn', () => {
    const mockAgreementData = {
      agreementNumber: 'FPTT123456789',
      status: 'withdrawn',
      sbi: '106284736'
    }

    beforeEach(() => {
      vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
        valid: true,
        source: 'defra',
        sbi: '106284736'
      })
      vi.spyOn(agreementDataHelper, 'getAgreementDataBySbi').mockResolvedValue(
        mockAgreementData
      )
    })

    test('should not call acceptOffer and return withdrawn agreement data', async () => {
      const { statusCode, result } = await doPost()

      expect(statusCode).toBe(statusCodes.ok)
      expect(acceptOfferHelper.acceptOffer).not.toHaveBeenCalled()
      expect(result.agreementData.status).toBe('withdrawn')
    })
  })

  describe('when agreement status is cancelled', () => {
    const mockAgreementData = {
      agreementNumber: 'FPTT123456789',
      status: 'cancelled',
      sbi: '106284736'
    }

    beforeEach(() => {
      vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
        valid: true,
        source: 'defra',
        sbi: '106284736'
      })
      vi.spyOn(agreementDataHelper, 'getAgreementDataBySbi').mockResolvedValue(
        mockAgreementData
      )
    })

    test('should not call acceptOffer and return cancelled agreement data', async () => {
      const { statusCode, result } = await doPost()

      expect(statusCode).toBe(statusCodes.ok)
      expect(acceptOfferHelper.acceptOffer).not.toHaveBeenCalled()
      expect(result.agreementData.status).toBe('cancelled')
    })
  })

  describe('authentication errors', () => {
    test('should return 401 when JWT validation fails', async () => {
      vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
        valid: false,
        error: 'Invalid token'
      })

      const { statusCode } = await doPost()

      expect(statusCode).toBe(statusCodes.unauthorized)
    })
  })
})
