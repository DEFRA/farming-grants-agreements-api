import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as nunjucksRenderer from '~/src/api/agreementDocument/helpers/nunjucks-renderer.js'
import * as agreementDataHelper from '~/src/api/agreementDocument/helpers/get-agreement-data.js'

// Mock the modules
jest.mock('~/src/api/agreementDocument/helpers/nunjucks-renderer.js')
jest.mock('~/src/api/agreementDocument/helpers/get-agreement-data.js')

describe('getAgreementDocumentController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  // Mock data for tests
  const mockAgreementData = {
    AGREEMENTNUMBER: 'TEST123456',
    AGREEMENTNAME: 'Test Agreement',
    SBI: '987654321',
    COMPANY: 'Test Farm Ltd',
    ADDRESS: '456 Test Lane, Testville',
    POSTCODE: 'TE1 2ST',
    USERNAME: 'Test User'
  }

  const mockRenderedHtml = `<!DOCTYPE html><html><body>Test HTML with ${mockAgreementData.AGREEMENTNUMBER}</body></html>`

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()

    // Setup mock implementations
    jest
      .spyOn(agreementDataHelper, 'getAgreementData')
      .mockImplementation(() => mockAgreementData)
    jest
      .spyOn(nunjucksRenderer, 'renderTemplate')
      .mockImplementation(() => mockRenderedHtml)
  })

  test('Should return HTML when valid agreement ID is provided', async () => {
    // Arrange
    const agreementId = 'TEST123456'

    // Act
    const { statusCode, headers, payload } = await server.inject({
      method: 'GET',
      url: `/api/agreement/${agreementId}`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(headers['content-type']).toContain('text/html')
    expect(payload).toBe(mockRenderedHtml)

    // Verify mocks were called correctly
    expect(agreementDataHelper.getAgreementData).toHaveBeenCalledWith(
      agreementId
    )
    expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
      'sfi-agreement.njk',
      mockAgreementData
    )
  })

  test('Should handle missing agreement ID', async () => {
    // Act
    const { statusCode, headers, payload } = await server.inject({
      method: 'GET',
      url: '/api/agreement/undefined'
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(headers['content-type']).toContain('text/html')
    expect(payload).toBe(mockRenderedHtml)

    // Verify the function defaulted to a reasonable value when ID was missing
    expect(agreementDataHelper.getAgreementData).toHaveBeenCalledWith(
      'undefined'
    )
  })

  test('Should handle error when template rendering fails', async () => {
    // Arrange
    const errorMessage = 'Template rendering failed'
    jest.spyOn(nunjucksRenderer, 'renderTemplate').mockImplementation(() => {
      throw new Error(errorMessage)
    })

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/api/agreement/TEST123456'
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to generate agreement document',
      error: errorMessage
    })
  })

  test('Should handle error when agreement data retrieval fails', async () => {
    // Arrange
    const errorMessage = 'Failed to retrieve agreement data'
    jest
      .spyOn(agreementDataHelper, 'getAgreementData')
      .mockImplementation(() => {
        throw new Error(errorMessage)
      })

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/api/agreement/TEST123456'
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to generate agreement document',
      error: errorMessage
    })
  })

  test('Should correctly render template with all expected data fields', async () => {
    // Act
    await server.inject({
      method: 'GET',
      url: '/api/agreement/TEST123456'
    })

    // Assert that all expected fields were passed to the template renderer
    const templateData = nunjucksRenderer.renderTemplate.mock.calls[0][1]
    expect(templateData).toHaveProperty('AGREEMENTNUMBER')
    expect(templateData).toHaveProperty('AGREEMENTNAME')
    expect(templateData).toHaveProperty('SBI')
    expect(templateData).toHaveProperty('COMPANY')
    expect(templateData).toHaveProperty('ADDRESS')
    expect(templateData).toHaveProperty('POSTCODE')
    expect(templateData).toHaveProperty('USERNAME')
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
