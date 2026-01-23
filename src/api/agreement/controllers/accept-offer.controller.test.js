import { vi } from 'vitest'
import Boom from '@hapi/boom'

import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import { unacceptOffer } from '~/src/api/agreement/helpers/unaccept-offer.js'
import { getAgreementDataBySbi } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'
import * as snsPublisher from '~/src/api/common/helpers/sns-publisher.js'
import { config } from '~/src/config/index.js'
import { calculatePaymentsBasedOnActions } from '~/src/api/adapter/land-grants-adapter.js'

vi.mock('~/src/api/agreement/helpers/accept-offer.js')
vi.mock('~/src/api/agreement/helpers/unaccept-offer.js')
vi.mock('~/src/api/agreement/helpers/update-payment-hub.js')
vi.mock(
  '~/src/api/agreement/helpers/get-agreement-data.js',
  async (importOriginal) => {
    const actual = await importOriginal()
    return { __esModule: true, ...actual, getAgreementDataBySbi: vi.fn() }
  }
)
vi.mock('~/src/api/common/helpers/jwt-auth.js')
vi.mock('~/src/api/common/helpers/sns-publisher.js')
vi.mock('~/src/api/adapter/land-grants-adapter.js', () => ({
  calculatePaymentsBasedOnActions: vi.fn()
}))

describe('acceptOfferDocumentController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server
  const mockLogger = { info: vi.fn(), error: vi.fn(), debug: vi.fn() }

  const mockAgreementData = {
    agreementNumber: 'FPTT123456789',
    status: 'offered',
    clientRef: 'test-client-ref',
    correlationId: 'test-correlation-id',
    code: 'test-code',
    actionApplications: [],
    payment: {
      agreementStartDate: '2024-01-01',
      agreementEndDate: '2027-12-31'
    },
    version: 1
  }

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
    calculatePaymentsBasedOnActions.mockResolvedValue({
      agreementStartDate: '2024-01-01',
      agreementEndDate: '2025-12-31',
      frequency: 'Annual',
      agreementTotalPence: 1000,
      annualTotalPence: 1000,
      parcelItems: [],
      agreementLevelItems: [],
      payments: []
    })

    // Reset mock implementations
    acceptOffer.mockReset()
    unacceptOffer.mockReset()
    getAgreementDataBySbi.mockReset()
    updatePaymentHub.mockReset()

    acceptOffer.mockResolvedValue({
      ...mockAgreementData,
      signatureDate: '2024-01-01T00:00:00.000Z',
      status: 'accepted'
    })
    unacceptOffer.mockResolvedValue()
    updatePaymentHub.mockResolvedValue({ claimId: 'R00000001' })

    // Setup default mock implementations with complete data structure
    getAgreementDataBySbi.mockResolvedValue(mockAgreementData)

    // Mock JWT auth functions to return valid authorization by default
    vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
      valid: true,
      source: 'defra',
      sbi: '106284736'
    })
  })

  test('should successfully accept an offer and return 200 OK', async () => {
    snsPublisher.publishEvent.mockResolvedValue(true)

    // Register a test-only extension to inject the mock logger
    server.ext('onPreHandler', (request, h) => {
      request.logger = mockLogger
      return h.continue
    })

    const agreementId = 'FPTT123456789'

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(getAgreementDataBySbi).toHaveBeenCalledWith('106284736')
    expect(acceptOffer).toHaveBeenCalledWith(
      agreementId,
      expect.objectContaining({
        agreementNumber: agreementId,
        status: 'offered'
      }),
      expect.objectContaining({
        info: expect.any(Function)
      })
    )
    expect(updatePaymentHub).toHaveBeenCalledWith(
      expect.any(Object),
      agreementId
    )
    expect(statusCode).toBe(statusCodes.ok)
    expect(result.agreementData.status).toContain('accepted')
    expect(result.agreementData.agreementNumber).toContain(agreementId)

    expect(snsPublisher.publishEvent).toHaveBeenCalledWith(
      {
        time: '2024-01-01T00:00:00.000Z',
        topicArn: 'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
        type: 'io.onsite.agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          version: 1,
          agreementUrl: `${config.get('viewAgreementURI')}/FPTT123456789`,
          clientRef: 'test-client-ref',
          status: 'accepted',
          date: '2024-01-01T00:00:00.000Z',
          code: 'test-code',
          endDate: '2027-12-31',
          claimId: 'R00000001'
        }
      },
      mockLogger
    )
  })

  test('should not accept an offer if the status is not offered', async () => {
    getAgreementDataBySbi.mockResolvedValue({
      ...mockAgreementData,
      status: 'withdrawn'
    })

    // Register a test-only extension to inject the mock logger
    server.ext('onPreHandler', (request, h) => {
      request.logger = mockLogger
      return h.continue
    })

    const agreementId = 'FPTT123456789'

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(getAgreementDataBySbi).toHaveBeenCalledWith('106284736')
    expect(acceptOffer).not.toHaveBeenCalled()
    expect(updatePaymentHub).not.toHaveBeenCalled()
    expect(snsPublisher.publishEvent).not.toHaveBeenCalled()

    expect(statusCode).toBe(statusCodes.ok)
    expect(result.agreementData.status).toContain('withdrawn')
    expect(result.agreementData.agreementNumber).toContain(agreementId)
  })

  test('should handle database errors from acceptOffer', async () => {
    // Arrange
    const error = new Error('Database connection failed')
    acceptOffer.mockRejectedValue(error)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      errorMessage: 'Database connection failed'
    })
  })

  test('should handle missing agreement ID', async () => {
    getAgreementDataBySbi.mockRejectedValue(Boom.notFound())

    // Act
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('should handle base URL header', async () => {
    const agreementId = 'FPTT123456789'

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/',
      headers: {
        'x-base-url': '/agreement',
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(result.agreementData.status).toContain('accepted')
    expect(result.agreementData.agreementNumber).toContain(agreementId)
  })

  test('should handle GET method when agreement is accepted', async () => {
    // Arrange
    const acceptedAgreementData = {
      ...mockAgreementData,
      status: 'accepted',
      payment: {
        ...mockAgreementData.payment,
        agreementStartDate: '2024-01-01'
      }
    }
    getAgreementDataBySbi.mockResolvedValue(acceptedAgreementData)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(result.agreementData.status).toContain('accepted')
    expect(result.agreementData.agreementNumber).toContain('FPTT123456789')
  })

  test('should rollback the accepting the agreement if the payment hub request fails', async () => {
    // Arrange
    const error = new Error('Payment hub request failed')
    updatePaymentHub.mockRejectedValue(error)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(unacceptOffer).toHaveBeenCalledWith('FPTT123456789')
    expect(result).toEqual({
      errorMessage: 'Payment hub request failed'
    })
    expect(snsPublisher.publishEvent).not.toHaveBeenCalled()
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
