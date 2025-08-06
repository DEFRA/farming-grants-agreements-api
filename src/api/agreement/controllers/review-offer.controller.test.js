import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as nunjucksRenderer from '~/src/api/agreement/helpers/nunjucks-renderer.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
import * as htmlAgreementHelper from '~/src/api/agreement/helpers/get-html-agreement.js'

// Mock the modules
jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')
jest.mock('~/src/api/agreement/helpers/get-html-agreement.js')

describe('reviewOfferController', () => {
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

    // Setup default mock implementations
    jest.spyOn(agreementDataHelper, 'getAgreementData')
    jest
      .spyOn(htmlAgreementHelper, 'getHTMLAgreementDocument')
      .mockResolvedValue(mockRenderedDocumentHtml)
    jest
      .spyOn(nunjucksRenderer, 'renderTemplate')
      .mockImplementation(() => mockRenderedHtml)
  })

  describe('not yet accepted', () => {
    test('should return the rendered HTML offer document', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [
              {
                code: 'SFI1',
                area: 10.5
              }
            ]
          }
        ],
        actions: [
          {
            code: 'SFI1',
            title: 'Arable and Horticultural Soils'
          }
        ],
        payments: {
          activities: [
            {
              code: 'SFI1',
              description: 'Arable and Horticultural Soils',
              rate: 28,
              annualPayment: 294
            }
          ],
          totalAnnualPayment: 294
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, headers, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(headers['content-type']).toContain('text/html')
      expect(result).toBe(mockRenderedHtml)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          agreementNumber: agreementId,
          actions: expect.arrayContaining([
            expect.objectContaining({
              name: 'Arable and Horticultural Soils',
              code: 'SFI1',
              landParcel: 'PARCEL001',
              quantity: 10.5
            })
          ]),
          payments: expect.arrayContaining([
            expect.objectContaining({
              name: 'Arable and Horticultural Soils',
              code: 'SFI1',
              rate: 28,
              yearly: 294
            })
          ]),
          totalYearly: 294,
          totalQuarterly: 73.5
        })
      )
    })

    test('should handle actions with missing action title and use activity code as fallback', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [
              {
                code: 'UNKNOWN_CODE',
                area: 5.0
              }
            ]
          }
        ],
        actions: [
          {
            code: 'SFI1',
            title: 'Arable and Horticultural Soils'
          }
        ],
        payments: {
          activities: [
            {
              code: 'SFI1',
              description: 'Arable and Horticultural Soils',
              rate: 28,
              annualPayment: 294
            }
          ],
          totalAnnualPayment: 294
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({
              name: 'UNKNOWN_CODE', // Should use activity code as fallback
              code: 'UNKNOWN_CODE',
              landParcel: 'PARCEL001',
              quantity: 5.0
            })
          ])
        })
      )
    })

    test('should handle payments with missing description and use payment code as fallback', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [
              {
                code: 'SFI1',
                area: 10.5
              }
            ]
          }
        ],
        actions: [
          {
            code: 'SFI1',
            title: 'Arable and Horticultural Soils'
          }
        ],
        payments: {
          activities: [
            {
              code: 'SFI1',
              description: null, // Missing description
              rate: 28,
              annualPayment: 294
            }
          ],
          totalAnnualPayment: 294
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          payments: expect.arrayContaining([
            expect.objectContaining({
              name: 'SFI1', // Should use payment code as fallback
              code: 'SFI1',
              rate: 28,
              yearly: 294
            })
          ]),
          totalQuarterly: 73.5
        })
      )
    })

    test('should handle empty parcels array', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [], // Empty parcels array
        actions: [],
        payments: {
          activities: [],
          totalAnnualPayment: 0
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          actions: [],
          payments: [],
          totalYearly: 0,
          totalQuarterly: 0
        })
      )
    })

    test('should handle parcels with empty activities array', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [] // Empty activities array
          }
        ],
        actions: [],
        payments: {
          activities: [],
          totalAnnualPayment: 0
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          actions: [],
          payments: [],
          totalYearly: 0,
          totalQuarterly: 0
        })
      )
    })

    test('should handle missing payments data', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [
              {
                code: 'SFI1',
                area: 10.5
              }
            ]
          }
        ],
        actions: [
          {
            code: 'SFI1',
            title: 'Arable and Horticultural Soils'
          }
        ]
        // Missing payments object
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          payments: [],
          totalYearly: 0,
          totalQuarterly: 0
        })
      )
    })

    test('should handle missing actions data', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [
              {
                code: 'SFI1',
                area: 10.5
              }
            ]
          }
        ]
        // Missing actions object - this will test the optional chaining operator
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({
              name: 'SFI1', // Should use activity code as fallback when actions is undefined
              code: 'SFI1',
              landParcel: 'PARCEL001',
              quantity: 10.5
            })
          ])
        })
      )
    })

    test('should handle grants proxy header', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '106284736',
        parcels: [],
        actions: [],
        payments: {
          activities: [],
          totalAnnualPayment: 0
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'defra-grants-proxy': 'true'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          grantsProxy: true
        })
      )
    })

    test('should handle grants proxy header as false', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '123456789',
        parcels: [],
        actions: [],
        payments: {
          activities: [],
          totalAnnualPayment: 0
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'defra-grants-proxy': 'false'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          grantsProxy: false
        })
      )
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
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toEqual({
        message: 'Failed to fetch offer',
        error: errorMessage
      })
    })

    test('should fail if getHTMLAgreementDocument throws an error', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const errorMessage = 'Failed to generate HTML document'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '123456789',
        parcels: [],
        actions: [],
        payments: {
          activities: [],
          totalAnnualPayment: 0
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)
      jest
        .spyOn(htmlAgreementHelper, 'getHTMLAgreementDocument')
        .mockRejectedValue(new Error(errorMessage))

      // Act
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toEqual({
        message: 'Failed to fetch offer',
        error: errorMessage
      })
    })

    test('should handle payments with null yearly values in reduce calculations', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '123456789',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [
              {
                code: 'SFI1',
                area: 10.5
              }
            ]
          }
        ],
        actions: [
          {
            code: 'SFI1',
            title: 'Arable and Horticultural Soils'
          }
        ],
        payments: {
          activities: [
            {
              code: 'SFI1',
              description: 'Arable and Horticultural Soils',
              rate: 28,
              annualPayment: 294
            },
            {
              code: 'SFI2',
              description: 'Test Action',
              rate: 10,
              annualPayment: null // This should test the || 0 condition
            },
            {
              code: 'SFI3',
              description: 'Another Test',
              rate: 15,
              annualPayment: undefined // This should test the || 0 condition
            }
          ],
          totalAnnualPayment: 294
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          payments: expect.arrayContaining([
            expect.objectContaining({
              name: 'Arable and Horticultural Soils',
              code: 'SFI1',
              rate: 28,
              yearly: 294
            }),
            expect.objectContaining({
              name: 'Test Action',
              code: 'SFI2',
              rate: 10,
              yearly: null
            }),
            expect.objectContaining({
              name: 'Another Test',
              code: 'SFI3',
              rate: 15,
              yearly: undefined
            })
          ]),
          totalYearly: 294, // Should only sum the valid values
          totalQuarterly: 73.5 // Should only sum the valid values
        })
      )
    })

    test('should handle parcels with null activities', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '123456789',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: null // This should test the ?? [] condition
          },
          {
            parcelNumber: 'PARCEL002',
            activities: [
              {
                code: 'SFI1',
                area: 10.5
              }
            ]
          }
        ],
        actions: [
          {
            code: 'SFI1',
            title: 'Arable and Horticultural Soils'
          }
        ],
        payments: {
          activities: [
            {
              code: 'SFI1',
              description: 'Arable and Horticultural Soils',
              rate: 28,
              annualPayment: 294
            }
          ],
          totalAnnualPayment: 294
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({
              name: 'Arable and Horticultural Soils',
              code: 'SFI1',
              landParcel: 'PARCEL002',
              quantity: 10.5
            })
          ])
        })
      )
    })

    test('should handle missing defra-grants-proxy header', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '123456789',
        parcels: [],
        actions: [],
        payments: {
          activities: [],
          totalAnnualPayment: 0
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
        // No headers - this should test the === 'true' condition
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          grantsProxy: false // Should be false when header is missing
        })
      )
    })

    test('should handle renderTemplate throwing an error', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const errorMessage = 'Template rendering failed'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '123456789',
        parcels: [],
        actions: [],
        payments: {
          activities: [],
          totalAnnualPayment: 0
        }
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
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toEqual({
        message: 'Failed to fetch offer',
        error: errorMessage
      })
    })

    test('should handle payments with zero yearly values', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'DRAFT',
        signatureDate: '2024-01-01',
        company: 'Test Company',
        sbi: '123456789',
        parcels: [
          {
            parcelNumber: 'PARCEL001',
            activities: [
              {
                code: 'SFI1',
                area: 10.5
              }
            ]
          }
        ],
        actions: [
          {
            code: 'SFI1',
            title: 'Arable and Horticultural Soils'
          }
        ],
        payments: {
          activities: [
            {
              code: 'SFI1',
              description: 'Arable and Horticultural Soils',
              rate: 28,
              annualPayment: 0 // This should test the || 0 condition with zero
            }
          ],
          totalAnnualPayment: 0
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(nunjucksRenderer.renderTemplate).toHaveBeenCalledWith(
        'views/view-offer.njk',
        expect.objectContaining({
          payments: expect.arrayContaining([
            expect.objectContaining({
              name: 'Arable and Horticultural Soils',
              code: 'SFI1',
              rate: 28,
              yearly: 0
            })
          ]),
          totalYearly: 0,
          totalQuarterly: 0
        })
      )
    })
  })

  describe('already accepted', () => {
    const agreementId = 'SFI123456789'

    beforeEach(() => {
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'accepted',
        company: 'Test Company',
        sbi: '106284736',
        username: 'Test User'
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementData')
        .mockResolvedValue(mockAgreementData)
    })

    test('should redirect to review offer', async () => {
      // Arrange
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`
      })

      // Assert
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`/offer-accepted/${agreementId}`)
      expect(nunjucksRenderer.renderTemplate).not.toHaveBeenCalled()
    })

    test('should redirect to review offer when grants proxy is true', async () => {
      // Arrange
      const agreementId = 'SFI123456789'

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/review-offer/${agreementId}`,
        headers: {
          'defra-grants-proxy': 'true'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`/agreement/offer-accepted/${agreementId}`)
      expect(nunjucksRenderer.renderTemplate).not.toHaveBeenCalled()
    })
  })
})
