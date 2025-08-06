import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'

jest.mock('~/src/api/agreement/helpers/accept-offer.js')
jest.mock('~/src/api/agreement/helpers/update-payment-hub.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')
jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')

describe('acceptOfferDocumentController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const mockRenderedHtml = `<!DOCTYPE html><html><body>Offer accepted</body></html>`

  beforeAll(async () => {
    server = await createServer({ disableSQS: true })
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset mock implementations
    acceptOffer.mockReset()
    getAgreementData.mockReset()
    updatePaymentHub.mockReset()
    renderTemplate.mockReset()

    acceptOffer.mockResolvedValue()
    updatePaymentHub.mockResolvedValue()
    renderTemplate.mockReturnValue(mockRenderedHtml)
  })

  describe('not yet accepted', () => {
    beforeEach(() => {
      // Setup default mock implementations
      getAgreementData.mockResolvedValue({
        agreementNumber: 'SFI123456789',
        status: 'offered',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      })
    })

    test('should return 400 Bad Request when not accepted', async () => {
      const agreementId = 'SFI123456789'

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/offer-accepted/${agreementId}`
      })

      // Assert
      expect(getAgreementData).toHaveBeenCalledWith({
        agreementNumber: agreementId
      })
      expect(acceptOffer).not.toHaveBeenCalled()
      expect(updatePaymentHub).not.toHaveBeenCalled()
      expect(renderTemplate).not.toHaveBeenCalled()
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result.message).toBe('Failed to display accept offer page')
      expect(result.error).toBe('Agreement has not been accepted')
    })

    test('should handle agreement not found error', async () => {
      // Arrange
      const agreementId = 'invalid-agreement-id'
      getAgreementData.mockResolvedValue(null)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/offer-accepted/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result.message).toContain('Failed to display accept offer page')
      expect(result.error).toBe(
        'Agreement not found with ID invalid-agreement-id'
      )
    })

    test('should handle missing agreement ID', async () => {
      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/offer-accepted/'
      })

      // Assert
      expect(statusCode).toBe(statusCodes.notFound)
      expect(result.message).toBe('Not Found')
    })
  })

  describe('already accepted', () => {
    const agreementId = 'SFI123456789'

    beforeEach(() => {
      // Setup default mock implementations
      getAgreementData.mockResolvedValue({
        agreementNumber: agreementId,
        status: 'accepted',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      })
    })

    test('should successfully show offer accepted page and return 200 OK', async () => {
      const agreementId = 'SFI123456789'

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/offer-accepted/${agreementId}`
      })

      // Assert
      expect(getAgreementData).toHaveBeenCalledWith({
        agreementNumber: agreementId
      })
      expect(acceptOffer).not.toHaveBeenCalled()
      expect(updatePaymentHub).not.toHaveBeenCalled()
      expect(renderTemplate).toHaveBeenCalledWith(
        'views/offer-accepted.njk',
        expect.objectContaining({
          agreementNumber: agreementId,
          company: 'Test Company',
          sbi: '106284736',
          farmerName: 'Test User',
          grantsProxy: false
        })
      )
      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toBe(mockRenderedHtml)
    })

    test('should handle grants proxy header', async () => {
      const agreementId = 'SFI123456789'

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/offer-accepted/${agreementId}`,
        headers: {
          'defra-grants-proxy': 'true'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(renderTemplate).toHaveBeenCalledWith(
        'views/offer-accepted.njk',
        expect.objectContaining({
          grantsProxy: true
        })
      )
      expect(headers['cache-control']).toBe(
        'no-cache, no-store, must-revalidate'
      )
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
