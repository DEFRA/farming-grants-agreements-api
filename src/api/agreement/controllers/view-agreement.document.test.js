import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as nunjucksRenderer from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'

// Mock the modules
jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')
jest.mock('~/src/api/agreement/helpers/get-html-agreement.js')

describe('viewAgreementDocumentController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  // Mock data for tests - matching the structure in agreement-data.json
  const mockAgreementData = {
    agreementNumber: 'SFI123456789',
    agreementName: 'Sample Agreement',
    sbi: '123456789',
    company: 'Sample Farm Ltd',
    address: '123 Farm Lane, Farmville',
    postcode: 'FA12 3RM',
    username: 'John Doe',
    agreementStartDate: '1/11/2024',
    agreementEndDate: '31/10/2027',
    signatureDate: '1/11/2024',
    actions: [
      {
        code: 'CSAM1A',
        title:
          'Assess soil, test soil organic matter and produce a soil management plan',
        startDate: '01/11/2024',
        endDate: '31/10/2027',
        duration: '3 years'
      }
    ],
    parcels: [
      {
        parcelNumber: 'SX63599044',
        parcelName: '',
        totalArea: 0.7306,
        activities: []
      }
    ],
    payments: {
      activities: [],
      totalAnnualPayment: 3886.69,
      yearlyBreakdown: {
        details: [],
        annualTotals: {
          year1: 4365.45,
          year2: 4126.07,
          year3: 4126.07
        },
        totalAgreementPayment: 12617.59
      }
    }
  }

  const mockRenderedDocumentHtml = `<!DOCTYPE html><html><body>Test document HTML with ${mockAgreementData.agreementNumber}</body></html>`
  const mockRenderedHtml = `<!DOCTYPE html><html><body>Test HTML with ${mockRenderedDocumentHtml}</body></html>`

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
