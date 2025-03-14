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

  const mockRenderedHtml = `<!DOCTYPE html><html><body>Test HTML with ${mockAgreementData.agreementNumber}</body></html>`

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
    const errorMessage = 'Failed to retrieve agreement data'
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

  test('Should correctly render template with all expected data fields', async () => {
    // Act
    await server.inject({
      method: 'GET',
      url: '/api/agreement/SFI123456789'
    })

    // Assert that all expected fields were passed to the template renderer
    const templateData = nunjucksRenderer.renderTemplate.mock.calls[0][1]
    expect(templateData).toHaveProperty('agreementNumber')
    expect(templateData).toHaveProperty('agreementName')
    expect(templateData).toHaveProperty('sbi')
    expect(templateData).toHaveProperty('company')
    expect(templateData).toHaveProperty('address')
    expect(templateData).toHaveProperty('postcode')
    expect(templateData).toHaveProperty('username')
    expect(templateData).toHaveProperty('agreementStartDate')
    expect(templateData).toHaveProperty('agreementEndDate')
    expect(templateData).toHaveProperty('actions')
    expect(templateData).toHaveProperty('parcels')
    expect(templateData).toHaveProperty('payments')
    expect(templateData.payments).toHaveProperty('yearlyBreakdown')
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
