import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import {
  acceptOffer,
  getFirstPaymentDate
} from '~/src/api/agreement/helpers/accept-offer.js'
import { getAgreementDataById } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'

jest.mock('~/src/api/agreement/helpers/accept-offer.js')
jest.mock('~/src/api/agreement/helpers/update-payment-hub.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  __esModule: true,
  ...jest.requireActual('~/src/api/agreement/helpers/get-agreement-data.js'),
  getAgreementDataById: jest.fn()
}))
jest.mock('~/src/api/common/helpers/jwt-auth.js')

describe('acceptOfferDocumentController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server
  const mockLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() }

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

    // Reset mock implementations
    acceptOffer.mockReset()
    getAgreementDataById.mockReset()
    updatePaymentHub.mockReset()

    acceptOffer.mockResolvedValue()
    updatePaymentHub.mockResolvedValue()

    // Setup default mock implementations with complete data structure
    getAgreementDataById.mockResolvedValue(mockAgreementData)

    // Mock JWT auth functions to return valid authorization by default
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(true)
  })

  const mockAgreementData = {
    agreementNumber: 'SFI123456789',
    status: 'offered',
    payment: {
      agreementStartDate: '2024-01-01'
    }
  }

  test('should successfully accept an offer and return 200 OK', async () => {
    // Register a test-only extension to inject the mock logger
    server.ext('onPreHandler', (request, h) => {
      request.logger = mockLogger
      return h.continue
    })

    const agreementId = 'SFI123456789'

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
    expect(getAgreementDataById).toHaveBeenCalledWith(agreementId)
    expect(acceptOffer).toHaveBeenCalledWith(
      agreementId,
      expect.objectContaining({
        agreementNumber: agreementId,
        status: 'offered'
      }),
      expect.stringContaining('http://localhost:3555/SFI123456789'),
      mockLogger
    )
    expect(updatePaymentHub).toHaveBeenCalled()
    expect(statusCode).toBe(statusCodes.ok)
    expect(String(result)).toContain('Offer accepted')
    expect(String(result)).toContain(agreementId)
  })

  test('should handle agreement not found error', async () => {
    // Arrange
    const agreementId = 'invalid-agreement-id'
    getAgreementDataById.mockResolvedValue(null)

    // Act
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
    expect(statusCode).toBe(500)
    expect(String(result)).toContain('Cannot read properties of null')
  })

  test('should handle database errors from acceptOffer', async () => {
    // Arrange
    const error = new Error('Database connection failed')
    acceptOffer.mockRejectedValue(error)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/SFI123456789`,
      payload: {
        action: 'accept-offer'
      },
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to accept offer',
      error: 'Database connection failed'
    })
  })

  test('should handle missing agreement ID', async () => {
    // Act
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/',
      payload: {
        action: 'accept-offer'
      },
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('should handle base URL header', async () => {
    const agreementId = 'SFI123456789'

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
    expect(String(result)).toContain('Offer accepted')
    expect(String(result)).toContain(agreementId)
    expect(String(result)).toContain('/agreement')
  })

  test('should handle GET method when agreement is accepted', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const acceptedAgreementData = {
      ...mockAgreementData,
      status: 'accepted',
      payment: {
        ...mockAgreementData.payment,
        agreementStartDate: '2024-01-01'
      }
    }
    getAgreementDataById.mockResolvedValue(acceptedAgreementData)
    getFirstPaymentDate.mockReturnValue('March 2025')

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: `/${agreementId}`,
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    // Assert
    expect(getFirstPaymentDate).toHaveBeenCalledWith('2024-01-01')
    expect(statusCode).toBe(statusCodes.ok)
    expect(String(result)).toContain('Offer accepted')
    expect(String(result)).toContain('Your agreement number is SFI123456789.')
    expect(String(result)).toContain(
      'You will receive your first payment for these actions in'
    )
    expect(String(result)).toContain('March 2025')
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
