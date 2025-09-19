import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { reviewOfferController } from '~/src/api/agreement/controllers/review-offer.controller.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
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

describe('reviewOfferController', () => {
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
    // Reset mocks before each test
    jest.clearAllMocks()

    // Setup default mock implementations
    jest.spyOn(agreementDataHelper, 'getAgreementDataById')

    // Mock JWT auth functions to return valid authorization by default
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(true)
  })

  describe('not yet accepted', () => {
    test('should return the rendered HTML offer document', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        sbi: '106284736',
        actionApplications: [
          {
            sheetId: 'SX635990',
            parcelId: '44',
            code: 'SFI1',
            appliedFor: { quantity: 10, unit: 'ha' }
          }
        ],
        payment: {
          annualTotalPence: 29400,
          parcelItems: {
            1: {
              code: 'SFI1',
              description: 'SFI1: Arable and Horticultural Soils',
              unit: 'hectares'
            }
          },
          agreementLevelItems: {}
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, headers, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(headers['content-type']).toContain('text/html')
      expect(String(result)).toContain('Review your funding offer')
      expect(String(result)).toContain('Arable and Horticultural Soils')
      expect(String(result)).toContain('SFI1')
    })

    test('should handle actions with missing action title and use activity code as fallback', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        sbi: '106284736',
        actionApplications: [
          {
            sheetId: 'SX111111',
            parcelId: 'PARCEL001',
            code: 'UNKNOWN_CODE',
            appliedFor: { quantity: 5, unit: 'ha' }
          }
        ],
        payment: {
          annualTotalPence: 0,
          parcelItems: {},
          agreementLevelItems: {}
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('UNKNOWN_CODE')
      expect(String(result)).toContain('PARCEL001')
    })

    test('should handle payments with missing description and use payment code as fallback', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        sbi: '106284736',
        actionApplications: [
          {
            sheetId: 'SX111111',
            parcelId: '44',
            code: 'SFI1',
            appliedFor: { quantity: 10, unit: 'ha' }
          }
        ],
        payment: {
          annualTotalPence: 29400,
          parcelItems: {
            1: {
              code: 'SFI1',
              description: 'SFI1: ', // Missing descriptive text after code
              unit: 'hectares'
            }
          },
          agreementLevelItems: {}
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('SFI1') // Should use payment code as fallback
    })

    test('should handle empty parcels array', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        sbi: '106284736',
        actionApplications: [],
        payment: {
          annualTotalPence: 0,
          parcelItems: {},
          agreementLevelItems: {}
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Review your funding offer')
    })

    test('should handle parcels with empty activities array', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        sbi: '106284736',
        actionApplications: [],
        payment: {
          annualTotalPence: 0,
          parcelItems: {},
          agreementLevelItems: {}
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Review your funding offer')
    })

    test('should handle missing payments data', async () => {
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        sbi: '106284736',
        actionApplications: [
          {
            sheetId: 'SX111111',
            parcelId: '44',
            code: 'SFI1',
            appliedFor: { quantity: 10, unit: 'ha' }
          }
        ],
        payment: {
          annualTotalPence: 0,
          parcelItems: {},
          agreementLevelItems: {}
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Review your funding offer')
    })

    test('should handle base URL header', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        sbi: '106284736',
        actionApplications: [],
        payment: {
          annualTotalPence: 0,
          parcelItems: {},
          agreementLevelItems: {}
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-base-url': '/agreement',
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Review your funding offer')
      expect(String(result)).toContain('/agreement')
    })

    test('should handle base URL header as false', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'offered',
        sbi: '123456789',
        actionApplications: [],
        payment: {
          annualTotalPence: 0,
          parcelItems: {},
          agreementLevelItems: {}
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-base-url': false,
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Review your funding offer')
    })

    test('should fail if theres an error reading the database', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const errorMessage = 'Failed to fetch agreement data'
      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockImplementation(() => {
          throw new Error(errorMessage)
        })

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(String(result)).toContain('Failed to fetch agreement data')
    })

    test('should fail if getAgreementDataById throws an error', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      const errorMessage = 'Failed to generate HTML document'

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockRejectedValue(new Error(errorMessage))

      // Act
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(String(result)).toContain('Failed to generate HTML document')
    })
  })

  describe('already accepted', () => {
    const agreementId = 'SFI123456789'

    beforeEach(() => {
      const mockAgreementData = {
        agreementNumber: agreementId,
        status: 'accepted',
        sbi: '106284736',
        payment: {
          annualTotalPence: 0,
          parcelItems: {},
          agreementLevelItems: {},
          agreementStartDate: '2025-12-05'
        }
      }

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue(mockAgreementData)
    })

    test('should redirect to accept offer when already accepted', async () => {
      // Arrange
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Offer accepted')
    })

    test('should handle base URL when already accepted', async () => {
      // Arrange
      const agreementId = 'SFI123456789'

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/${agreementId}`,
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-base-url': '/agreement',
          'x-encrypted-auth': 'valid-jwt-token'
        }
      })

      // Assert
      expect(statusCode).toBe(statusCodes.ok)
      expect(String(result)).toContain('Offer accepted')
      expect(String(result)).toContain('/agreement')
    })
  })

  describe('JWT Authorization', () => {
    beforeEach(() => {
      jest.clearAllMocks()

      jest
        .spyOn(agreementDataHelper, 'getAgreementDataById')
        .mockResolvedValue({
          sbi: '106284736',
          agreementNumber: 'SFI123456789',
          status: 'offered'
        })
    })

    test('Should return 401 when invalid JWT token provided', async () => {
      jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(false)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/SFI123456789',
        payload: {
          action: 'review-offer'
        },
        headers: {
          'x-encrypted-auth': 'invalid-token'
        }
      })

      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(String(result)).toContain('<!DOCTYPE html>')
      expect(String(result)).toContain(
        'You are not authorized to access this page'
      )
    })
  })

  describe('reviewOfferController.handler (unit)', () => {
    /** Simple chainable h toolkit mocks */
    const createHToolkit = () => {
      const calls = {
        view: null,
        header: null,
        code: null,
        response: null
      }

      const chain = {
        header: (key, value) => {
          calls.header = [key, value]
          return chain
        },
        code: (status) => {
          calls.code = status
          return { statusCode: status, calls }
        }
      }

      const h = {
        view: (template, context) => {
          calls.view = [template, context]
          return chain
        },
        response: (payload) => {
          calls.response = payload
          return {
            code: (status) => ({ statusCode: status, result: payload, calls })
          }
        }
      }

      return { h, calls, chain }
    }

    test('renders view with transformed payments, totals and headers', () => {
      const request = {
        auth: {
          credentials: {
            agreementData: {
              actionApplications: [{ code: 'A1' }],
              payment: {
                annualTotalPence: 123400,
                parcelItems: {
                  1: {
                    code: 'B02',
                    description: 'B02: Bravo',
                    unit: 'units'
                  },
                  2: {
                    code: 'A01',
                    description: 'A01: Alpha',
                    unit: 'hours'
                  }
                },
                agreementLevelItems: {
                  1: { code: 'C99', annualPaymentPence: 2500 }
                },
                payments: [
                  {
                    totalPaymentPence: 6800,
                    paymentDate: '2025-12-05',
                    lineItems: [
                      {
                        agreementLevelItemId: 1,
                        paymentPence: 1
                      },
                      {
                        parcelItemId: 1,
                        paymentPence: 2
                      },
                      {
                        parcelItemId: 2,
                        paymentPence: 3
                      }
                    ]
                  }
                ]
              }
            }
          }
        },
        logger: { error: jest.fn() }
      }

      const { h, calls } = createHToolkit()

      const res = reviewOfferController.handler(request, h)

      // Status
      expect(res.statusCode).toBe(statusCodes.ok)

      // Header set
      expect(calls.header).toEqual([
        'Cache-Control',
        'no-cache, no-store, must-revalidate'
      ])

      // View called with expected template
      expect(calls.view[0]).toBe('views/view-offer.njk')

      const context = calls.view[1]

      // actionApplications passed through
      expect(context.actionApplications).toEqual([{ code: 'A1' }])

      // codeDescriptions built from parcel descriptions (without the leading "CODE: ")
      expect(context.codeDescriptions).toEqual({
        A01: 'Alpha',
        B02: 'Bravo',
        C99: undefined // not present in parcelItems, so undefined
      })

      // payments merged and sorted by code, with transformations applied
      const codes = context.payments.map((p) => p.code)
      expect(codes).toEqual(['A01', 'B02', 'C99'])

      const a01 = context.payments.find((p) => p.code === 'A01')
      expect(a01.description).toBe('Alpha')
      expect(a01.unit).toBe('hour') // singularized
      expect(a01.quarterlyPayment).toBe(3)

      const b02 = context.payments.find((p) => p.code === 'B02')

      expect(b02.description).toBe('Bravo')
      expect(b02.unit).toBe('unit') // singularized
      expect(b02.quarterlyPayment).toBe(2)

      const c99 = context.payments.find((p) => p.code === 'C99')
      expect(c99.description).toBe(
        'One-off payment per agreement per year for undefined'
      )
      expect(c99.rateInPence).toBe(2500)
      expect(c99.quarterlyPayment).toBe(1)

      // totals
      expect(context.totalYearly).toBe(123400)
      expect(context.totalQuarterly).toBe(6800)
    })

    test('throws Boom errors (from h.view) through to error handler', () => {
      const request = {
        auth: {
          credentials: {
            agreementData: {
              actionApplications: [],
              payment: {
                annualTotalPence: 0,
                parcelItems: {},
                agreementLevelItems: {}
              }
            }
          }
        },
        logger: { error: jest.fn() }
      }

      const error = new Error('Boom-like error')
      error.isBoom = true

      const h = {
        view: () => {
          throw error
        }
      }

      expect(() => reviewOfferController.handler(request, h)).toThrow(error)
    })

    test('handles non-Boom errors and returns 500 response with message', () => {
      // Cause an error early in the try block (missing credentials)
      const request = {
        auth: {},
        logger: { error: jest.fn() }
      }

      const createHToolkitLocal = createHToolkit
      const { h } = createHToolkitLocal()

      const res = reviewOfferController.handler(request, h)

      expect(res.statusCode).toBe(statusCodes.internalServerError)
      expect(res.result).toEqual(
        expect.objectContaining({ message: 'Failed to fetch offer' })
      )
      expect(request.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching offer:')
      )
    })
  })
})
