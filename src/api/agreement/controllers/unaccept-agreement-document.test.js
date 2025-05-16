import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { unacceptAgreement } from '~/src/api/agreement/helpers/unaccept-agreement.js'

jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/unaccept-agreement.js')
jest.mock('~/src/api/agreement/helpers/update-payment-hub.js')

describe('unacceptAgreementDocumentController', () => {
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
    jest.clearAllMocks()
  })

  test('should successfully unaccept an agreement and return 200 OK', async () => {
    const agreementId = 'SFI123456789'

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/api/agreement/${agreementId}/unaccept`
    })

    // Assert
    expect(unacceptAgreement).toHaveBeenCalledWith('SFI123456789')
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual({
      message: 'Agreement unaccepted'
    })
  })

  test('should handle agreement not found error', async () => {
    // Arrange
    const agreementId = 'invalid-agreement-id'

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/api/agreement/${agreementId}/unaccept`
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
    unacceptAgreement.mockRejectedValue(error)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `/api/agreement/valid-agreement-id/unaccept`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to unaccept agreement document',
      error: 'Database connection failed'
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
