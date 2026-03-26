import { vi } from 'vitest'
import Boom from '@hapi/boom'

import { createServer } from '#~/api/index.js'
import { acceptOfferController } from './accept-offer.controller.js'
import { getAgreementController } from './get-agreement.controller.js'
import { statusCodes } from '#~/api/common/constants/status-codes.js'
import { acceptOffer } from '#~/api/agreement/helpers/accept-offer.js'
import { unacceptOffer } from '#~/api/agreement/helpers/unaccept-offer.js'
import {
  getAgreementDataBySbi,
  getAgreementDataById
} from '#~/api/agreement/helpers/get-agreement-data.js'
import { createGrantPaymentFromAgreement } from '#~/api/common/helpers/create-grant-payment-from-agreement.js'
import * as jwtAuth from '#~/api/common/helpers/jwt-auth.js'
import * as snsPublisher from '#~/api/common/helpers/sns-publisher.js'
import { config } from '#~/config/index.js'
import { calculatePaymentsBasedOnActions } from '#~/api/adapter/land-grants-adapter.js'
import {
  auditEvent as mockAuditEvent,
  AuditEvent
} from '#~/api/common/helpers/audit-event.js'

vi.mock('#~/api/agreement/helpers/accept-offer.js')
vi.mock('#~/api/agreement/helpers/unaccept-offer.js')
vi.mock('#~/api/common/helpers/create-grant-payment-from-agreement.js')
vi.mock('#~/api/common/helpers/audit-event.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, auditEvent: vi.fn() }
})
vi.mock(
  '#~/api/agreement/helpers/get-agreement-data.js',
  async (importOriginal) => {
    const actual = await importOriginal()
    return {
      __esModule: true,
      ...actual,
      getAgreementDataBySbi: vi.fn(),
      getAgreementDataById: vi.fn()
    }
  }
)
vi.mock('#~/api/common/helpers/jwt-auth.js', () => ({
  validateJwtAuthentication: vi.fn()
}))
vi.mock('#~/api/common/helpers/sns-publisher.js')
vi.mock('#~/api/adapter/land-grants-adapter.js', () => ({
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
    createdAt: '2023-12-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    actionApplications: [],
    payment: {
      agreementStartDate: '2024-01-01',
      agreementEndDate: '2027-12-31'
    },
    version: 1
  }

  beforeAll(async () => {
    server = await createServer({ disableSQS: true })
    // Add a route that we know matches and uses the same controller
    server.route({
      method: 'POST',
      path: '/test-accept',
      options: { auth: 'grants-ui-jwt' },
      handler: acceptOfferController
    })
    server.route({
      method: 'GET',
      path: '/test-accept',
      options: { auth: 'grants-ui-jwt' },
      handler: getAgreementController({ allowEntra: false })
    })
    await server.initialize()
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2024-01-03T12:34:56.789Z'))
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
    getAgreementDataById.mockReset()
    createGrantPaymentFromAgreement.mockReset()
    mockAuditEvent.mockReturnValue(undefined)

    acceptOffer.mockResolvedValue({
      ...mockAgreementData,
      signatureDate: '2024-01-01T00:00:00.000Z',
      status: 'accepted'
    })
    unacceptOffer.mockResolvedValue()
    createGrantPaymentFromAgreement.mockResolvedValue({
      sbi: '106284736',
      grants: []
    })
    // Setup default mock implementations with complete data structure
    getAgreementDataBySbi.mockResolvedValue(mockAgreementData)
    getAgreementDataById.mockResolvedValue(mockAgreementData)

    // Mock JWT auth functions to return valid authorization by default
    jwtAuth.validateJwtAuthentication.mockReturnValue({
      valid: true,
      source: 'defra',
      sbi: '106284736'
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('should successfully accept an offer and return 200 OK', async () => {
    snsPublisher.publishEvent.mockResolvedValue(true)

    const agreementId = 'FPTT123456789'

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/test-accept',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      },
      app: {
        logger: mockLogger
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
      expect.anything()
    )
    expect(createGrantPaymentFromAgreement).toHaveBeenCalledWith(
      agreementId,
      expect.anything()
    )
    expect(statusCode).toBe(statusCodes.ok)
    expect(result.agreementData.status).toContain('accepted')
    expect(result.agreementData.agreementNumber).toContain(agreementId)

    expect(snsPublisher.publishEvent).toHaveBeenCalledWith(
      {
        time: '2024-01-03T12:34:56.789Z',
        topicArn: config.get('aws.sns.topic.createPayment.arn'),
        type: config.get('aws.sns.topic.createPayment.type'),
        data: {
          sbi: '106284736',
          grants: []
        }
      },
      expect.anything()
    )

    expect(snsPublisher.publishEvent).toHaveBeenCalledWith(
      {
        time: '2024-01-03T12:34:56.789Z',
        topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
        type: 'io.onsite.agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          version: 1,
          agreementUrl: `${String(config.get('viewAgreementURI'))}/FPTT123456789`,
          clientRef: 'test-client-ref',
          status: 'accepted',
          code: 'test-code',
          date: '2024-01-02T00:00:00.000Z',
          startDate: '2024-01-01',
          endDate: '2027-12-31'
          // claimId: 'R00000001'
        }
      },
      expect.anything()
    )

    expect(mockAuditEvent).toHaveBeenCalledWith(
      AuditEvent.AGREEMENT_CREATED,
      expect.objectContaining({
        agreementNumber: 'FPTT123456789',
        status: 'accepted'
      })
    )
  })

  test('should not accept an offer if the status is not offered', async () => {
    getAgreementDataBySbi.mockResolvedValue({
      ...mockAgreementData,
      status: 'withdrawn'
    })

    const agreementId = 'FPTT123456789'

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/test-accept',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      },
      app: {
        logger: mockLogger
      }
    })

    // Assert
    expect(getAgreementDataBySbi).toHaveBeenCalledWith('106284736')
    expect(acceptOffer).not.toHaveBeenCalled()
    expect(createGrantPaymentFromAgreement).not.toHaveBeenCalled()
    expect(snsPublisher.publishEvent).not.toHaveBeenCalled()
    expect(mockAuditEvent).not.toHaveBeenCalled()

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
      url: '/test-accept',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      },
      app: {
        logger: mockLogger
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
      url: '/test-accept',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      },
      app: {
        logger: mockLogger
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('should handle base URL header', async () => {
    const agreementId = 'FPTT123456789'

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/test-accept',
      headers: {
        'x-base-url': '/agreement',
        'x-encrypted-auth': 'valid-jwt-token'
      },
      app: {
        logger: mockLogger
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
      url: '/test-accept',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      },
      app: {
        logger: mockLogger
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
    createGrantPaymentFromAgreement.mockRejectedValue(error)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/test-accept',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      },
      app: {
        logger: mockLogger
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(unacceptOffer).toHaveBeenCalledWith('FPTT123456789')
    expect(result).toEqual({
      errorMessage: 'Payment hub request failed'
    })
    expect(snsPublisher.publishEvent).not.toHaveBeenCalled()
    expect(mockAuditEvent).toHaveBeenCalledWith(
      AuditEvent.AGREEMENT_CREATED,
      expect.objectContaining({
        agreementNumber: 'FPTT123456789',
        message: 'Payment hub request failed'
      }),
      'failure'
    )
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
