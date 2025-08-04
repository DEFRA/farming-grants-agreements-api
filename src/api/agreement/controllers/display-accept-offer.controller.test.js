import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as nunjucksRenderer from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'

// Mock the modules
jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')

describe('displayAcceptOfferController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const mockRenderedHtml = `<!DOCTYPE html><html><body>Test accept offer HTML</body></html>`

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

    // Setup default mock implementations
    jest.spyOn(agreementDataHelper, 'getAgreementData')
    jest
      .spyOn(nunjucksRenderer, 'renderTemplate')
      .mockImplementation(() => mockRenderedHtml)
  })

  test('should return the rendered HTML accept offer page', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const mockAgreementData = {
      agreementNumber: agreementId,
      status: 'offered',
      company: 'Test Company',
      sbi: '106284736',
      username: 'Test User'
    }

    jest
      .spyOn(agreementDataHelper, 'getAgreementData')
      .mockResolvedValue(mockAgreementData)

    // Act
    const { statusCode, headers, result } = await server.inject({
      method: 'GET',
      url: `/review-accept-offer/${agreementId}`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(headers['content-type']).toContain('text/html')
    expect(result).toBe(mockRenderedHtml)
    expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
      'views/accept-offer.njk',
      expect.objectContaining({
        agreementNumber: agreementId,
        company: 'Test Company',
        sbi: '106284736',
        farmerName: 'Test User',
        status: 'offered',
        grantsProxy: false
      })
    )
  })

  test('should handle agreement not found', async () => {
    // Arrange
    const agreementId = 'INVALID123'
    jest.spyOn(agreementDataHelper, 'getAgreementData').mockResolvedValue(null)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: `/review-accept-offer/${agreementId}`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.notFound)
    expect(result).toEqual({
      message: 'Agreement not found',
      error: 'Not Found'
    })
  })

  test('should handle grants proxy header', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const mockAgreementData = {
      agreementNumber: agreementId,
      status: 'offered',
      company: 'Test Company',
      sbi: '106284736',
      username: 'Test User'
    }

    jest
      .spyOn(agreementDataHelper, 'getAgreementData')
      .mockResolvedValue(mockAgreementData)

    // Act
    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/review-accept-offer/${agreementId}`,
      headers: {
        'defra-grants-proxy': 'true'
      }
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
      'views/accept-offer.njk',
      expect.objectContaining({
        grantsProxy: true,
        status: 'offered'
      })
    )
  })

  test('should handle database errors', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const errorMessage = 'Database connection failed'
    jest
      .spyOn(agreementDataHelper, 'getAgreementData')
      .mockRejectedValue(new Error(errorMessage))

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: `/review-accept-offer/${agreementId}`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to display accept offer page',
      error: errorMessage
    })
  })

  test('should handle template rendering errors', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const errorMessage = 'Template rendering failed'
    const mockAgreementData = {
      agreementNumber: agreementId,
      status: 'offered',
      company: 'Test Company',
      sbi: '106284736',
      username: 'Test User'
    }

    jest
      .spyOn(agreementDataHelper, 'getAgreementData')
      .mockResolvedValue(mockAgreementData)
    jest.spyOn(nunjucksRenderer, 'renderTemplate').mockImplementation(() => {
      throw new Error(errorMessage)
    })

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: `/review-accept-offer/${agreementId}`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to display accept offer page',
      error: errorMessage
    })
  })
})
