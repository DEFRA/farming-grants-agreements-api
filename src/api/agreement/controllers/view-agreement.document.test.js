import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as nunjucksRenderer from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'

// Mock the modules
jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')
jest.mock('~/src/api/agreement/helpers/get-html-agreement.js')

describe('viewAgreementDocumentController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const mockRenderedDocumentHtml = `<!DOCTYPE html><html><body>Test document HTML</body></html>`
  const mockRenderedHtml = `<!DOCTYPE html><html><body>Test HTML with ${mockRenderedDocumentHtml}</body></html>`

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

    // Setup mock implementations
    jest.spyOn(agreementDataHelper, 'getAgreementData')
    jest
      .spyOn(nunjucksRenderer, 'renderTemplate')
      .mockImplementationOnce(() => mockRenderedHtml)
  })

  test('should return the rendered HTML agreement document', async () => {
    // Arrange
    const agreementId = 'SFI123456789'

    // Act
    const { statusCode, headers, result } = await server.inject({
      method: 'GET',
      url: `/agreement/${agreementId}`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(headers['content-type']).toContain('text/html')
    expect(result).toBe(mockRenderedHtml)
  })

  test('should fail if theres an error reading the database', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const errorMessage = 'Failed to fetch agreement data'
    jest
      .spyOn(agreementDataHelper, 'getAgreementData')
      .mockImplementation(() => {
        throw new Error(errorMessage)
      })

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: `/agreement/${agreementId}`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toEqual({
      message: 'Failed to fetch agreement document',
      error: errorMessage
    })
  })
})
