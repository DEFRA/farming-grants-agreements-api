import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as nunjucksRenderer from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'

// Mock the modules
jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')

describe('getHTMLAgreementDocumentController', () => {
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
  })

  test('Should return HTML when valid agreement ID is provided', async () => {
    // Arrange
    const agreementId = 'SFI123456789'

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
      expect.objectContaining({
        agreementNumber: agreementId
      })
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
    const errorMessage = 'Failed to render HTML'
    jest.spyOn(nunjucksRenderer, 'renderTemplate').mockImplementation(() => {
      throw new Error(errorMessage)
    })

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/api/agreement/SFI123456789'
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
    const errorMessage = 'Failed to render HTML'
    jest
      .spyOn(agreementDataHelper, 'getAgreementData')
      .mockImplementation(() => {
        throw new Error(errorMessage)
      })

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/api/agreement/SFI123456789'
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to generate agreement document',
      error: errorMessage
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
