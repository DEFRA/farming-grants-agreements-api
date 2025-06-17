import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptAgreement } from '~/src/api/agreement/helpers/accept-agreement.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import { publishMessage } from '~/src/api/common/helpers/sns-publisher.js'

jest.mock('~/src/api/agreement/helpers/accept-agreement.js')
jest.mock('~/src/api/agreement/helpers/update-payment-hub.js')
jest.mock('~/src/api/common/helpers/sns-publisher.js')

describe('acceptAgreementDocumentController', () => {
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
    process.env.NODE_ENV = 'development'
    jest.clearAllMocks()
    // Mock successful responses for updatePaymentHub and publishMessage
    updatePaymentHub.mockResolvedValue(undefined)
    publishMessage.mockResolvedValue(undefined)
  })

  test('should successfully accept an agreement and return 200 OK', async () => {
    const agreementId = 'SFI123456789'

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/api/agreement/${agreementId}/accept`
    })

    // Assert
    expect(acceptAgreement).toHaveBeenCalledWith('SFI123456789')
    expect(updatePaymentHub).toHaveBeenCalledWith(
      expect.any(Object),
      'SFI123456789'
    )
    expect(publishMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agreement_accepted',
        agreementId: 'SFI123456789'
      }),
      expect.any(Object)
    )
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual({
      message: 'Agreement accepted'
    })
  })

  test('should handle agreement not found error', async () => {
    // Arrange
    const agreementId = 'invalid-agreement-id'

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/api/agreement/${agreementId}/accept`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.notFound)
    expect(result).toEqual({
      message: 'Agreement not found',
      error: 'Not Found',
      statusCode: statusCodes.notFound
    })
  })

  test('should handle database errors from acceptAgreement', async () => {
    // Arrange
    const error = new Error('Database connection failed')
    acceptAgreement.mockRejectedValue(error)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/api/agreement/valid-agreement-id/accept`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to accept agreement document',
      error: 'Database connection failed'
    })
  })

  test('should handle payment hub update errors', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const error = new Error('Payment hub update failed')
    acceptAgreement.mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
    updatePaymentHub.mockRejectedValue(error)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/api/agreement/${agreementId}/accept`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to accept agreement document',
      error: 'Payment hub update failed'
    })
  })

  test('should handle SNS publish errors', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const error = new Error('SNS publish failed')
    acceptAgreement.mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
    publishMessage.mockRejectedValue(error)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/api/agreement/${agreementId}/accept`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to accept agreement document',
      error: 'SNS publish failed'
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
