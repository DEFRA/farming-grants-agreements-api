import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
import * as getAgreement from '~/src/api/agreement/helpers/get-agreement.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'

// Mock the modules
jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  __esModule: true,
  ...jest.requireActual('~/src/api/agreement/helpers/get-agreement-data.js'),
  getAgreementDataById: jest.fn()
}))
jest.mock('~/src/api/agreement/helpers/get-agreement.js')
jest.mock('~/src/api/common/helpers/jwt-auth.js')
jest.mock('@hapi/jwt')

describe('viewAgreementController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const mockRenderedHtml = `<html><body>Test HTML with SFI123456789</body></html>`

  beforeAll(async () => {
    server = await createServer({ disableSQS: true })
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()

    // Mock default successful responses for all tests
    jest.spyOn(getAgreement, 'getAgreement').mockResolvedValue(mockRenderedHtml)

    // Mock JWT auth functions
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(true)
  })

  describe('Offer accepted', () => {
    const mockAgreementData = {
      sbi: '106284736',
      status: 'accepted',
      agreementNumber: 'SFI123456789'
    }

    beforeEach(() => {
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)
    })

    test('Should return HTML when valid agreement ID and valid auth are provided', async () => {
      // Arrange
      const agreementId = 'SFI123456789'

      // Act
      const { statusCode, headers, payload } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'view-agreement'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(headers['content-type']).toContain('text/html')
      expect(payload).toContain('Agile Farm agreement')

      // Verify mocks were called correctly
      expect(agreementDataHelper.getAgreementDataById).toHaveBeenCalledWith(
        agreementId
      )
      expect(getAgreement.getAgreement).toHaveBeenCalledWith(
        agreementId,
        mockAgreementData
      )
    })

    test('Should handle missing agreement ID', async () => {
      // Act
      const { statusCode, headers, payload } = await server.inject({
        method: 'POST',
        url: '/undefined',
        payload: {
          action: 'view-agreement'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(headers['content-type']).toContain('text/html')
      expect(payload).toContain('Agile Farm agreement')

      // Verify the function defaulted to a reasonable value when ID was missing
      expect(agreementDataHelper.getAgreementDataById).toHaveBeenCalledWith(
        'undefined'
      )
    })

    test('Should handle error when template rendering fails', async () => {
      // Arrange
      const errorMessage = 'Failed to render HTML'
      jest
        .spyOn(getAgreement, 'getAgreement')
        .mockRejectedValue(new Error(errorMessage))

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/SFI123456789',
        payload: {
          action: 'view-agreement'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result.message).toBe('Failed to generate agreement document')
    })

    test('Should handle error when agreement data retrieval fails', async () => {
      // Arrange
      const errorMessage = 'Failed to render HTML'
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockImplementation(() => {
          throw new Error(errorMessage)
        })

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/SFI123456789',
        payload: {
          action: 'view-agreement'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(String(result)).toContain('Failed to render HTML')
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
