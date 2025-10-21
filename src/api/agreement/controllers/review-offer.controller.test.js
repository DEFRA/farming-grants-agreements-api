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
    if (server) {
      await server.stop({ timeout: 0 })
    }
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
      expect(headers['content-type']).toContain(
        'application/json; charset=utf-8'
      )
      expect(result.agreement.status).toContain('offered')
      expect(result.agreement.payment.parcelItems[1].description).toContain(
        'Arable and Horticultural Soils'
      )
      expect(result.agreement.payment.parcelItems[1].description).toContain(
        'SFI1'
      )
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
      expect(result.agreement.actionApplications[0].code).toContain(
        'UNKNOWN_CODE'
      )
      expect(result.agreement.actionApplications[0].parcelId).toContain(
        'PARCEL001'
      )
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
      expect(result.agreement.actionApplications[0].code).toContain('SFI1') // Should use payment code as fallback
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
      expect(result.agreement.status).toContain('offered')
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
      expect(result.agreement.status).toContain('offered')
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
      expect(result.agreement.status).toContain('offered')
    })

    test('should display first payment and subsequent payments from payment structure', async () => {
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
          annualTotalPence: 4783,
          parcelItems: {
            1: {
              code: 'SFI1',
              description: 'SFI1: Arable and Horticultural Soils',
              unit: 'hectares',
              annualPaymentPence: 4783
            }
          },
          agreementLevelItems: {},
          payments: [
            {
              totalPaymentPence: 1183,
              paymentDate: '2025-12-05',
              lineItems: [
                {
                  parcelItemId: 1,
                  paymentPence: 1183
                }
              ]
            },
            {
              totalPaymentPence: 1200,
              paymentDate: '2026-03-05',
              lineItems: [
                {
                  parcelItemId: 1,
                  paymentPence: 1200
                }
              ]
            }
          ]
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
      expect(result.agreement.payment.payments[0].totalPaymentPence).toBe(1183)
      expect(result.agreement.payment.payments[1].totalPaymentPence).toBe(1200)
    })

    test('should handle payments with integer division correctly', async () => {
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
          annualTotalPence: 10000,
          parcelItems: {
            1: {
              code: 'SFI1',
              description: 'SFI1: Arable and Horticultural Soils',
              unit: 'hectares',
              annualPaymentPence: 10000
            }
          },
          agreementLevelItems: {},
          payments: [
            {
              totalPaymentPence: 2500,
              paymentDate: '2025-12-05',
              lineItems: [
                {
                  parcelItemId: 1,
                  paymentPence: 2500
                }
              ]
            },
            {
              totalPaymentPence: 2500,
              paymentDate: '2026-03-05',
              lineItems: [
                {
                  parcelItemId: 1,
                  paymentPence: 2500
                }
              ]
            }
          ]
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
      expect(result.agreement.payment.payments[0].totalPaymentPence).toBe(2500) // Both first and subsequent should be £25.00
    })

    test('should calculate total first payment and total subsequent payment correctly with multiple payments', async () => {
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
          },
          {
            sheetId: 'SX635991',
            parcelId: '45',
            code: 'SFI2',
            appliedFor: { quantity: 5, unit: 'ha' }
          }
        ],
        payment: {
          annualTotalPence: 9783,
          parcelItems: {
            1: {
              code: 'SFI1',
              description: 'SFI1: Payment 1',
              unit: 'hectares',
              annualPaymentPence: 4783
            },
            2: {
              code: 'SFI2',
              description: 'SFI2: Payment 2',
              unit: 'hectares',
              annualPaymentPence: 5000
            }
          },
          agreementLevelItems: {},
          payments: [
            {
              totalPaymentPence: 2283,
              paymentDate: '2025-12-05',
              lineItems: [
                {
                  parcelItemId: 1,
                  paymentPence: 1183
                },
                {
                  parcelItemId: 2,
                  paymentPence: 1100
                }
              ]
            },
            {
              totalPaymentPence: 2500,
              paymentDate: '2026-03-05',
              lineItems: [
                {
                  parcelItemId: 1,
                  paymentPence: 1200
                },
                {
                  parcelItemId: 2,
                  paymentPence: 1300
                }
              ]
            }
          ]
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
      expect(result.agreement.payment.payments[0].totalPaymentPence).toBe(2283)
      expect(result.agreement.payment.payments[1].totalPaymentPence).toBe(2500)
      expect(result.agreement.payment.annualTotalPence).toBe(9783)
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
      expect(result.errorMessage).toContain('Failed to fetch agreement data')
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
      expect(result.errorMessage).toContain('Failed to generate HTML document')
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
      expect(result.agreement.status).toContain('accepted')
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
      expect(result.agreement.status).toContain('accepted')
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
      expect(result.errorMessage).toContain(
        'Not authorized to accept offer agreement document'
      )
    })
  })

  describe('reviewOfferController.handler (unit)', () => {
    /** Simple chainable h toolkit mocks */
    const createHToolkit = () => {
      const calls = {
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
        response: (payload) => {
          calls.response = payload
          return {
            code: (status) => ({ statusCode: status, result: payload, calls }),
            header: () => ({
              code: (status) => ({ statusCode: status, result: payload, calls })
            })
          }
        }
      }

      return { h, calls, chain }
    }

    test('renders response with transformed payments, totals and headers', () => {
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

      expect(calls.response.agreementData).toEqual({
        actionApplications: [{ code: 'A1' }],
        payment: {
          agreementLevelItems: { 1: { annualPaymentPence: 2500, code: 'C99' } },
          annualTotalPence: 123400,
          parcelItems: {
            1: { code: 'B02', description: 'B02: Bravo', unit: 'units' },
            2: { code: 'A01', description: 'A01: Alpha', unit: 'hours' }
          },
          payments: [
            {
              lineItems: [
                { agreementLevelItemId: 1, paymentPence: 1 },
                { parcelItemId: 1, paymentPence: 2 },
                { parcelItemId: 2, paymentPence: 3 }
              ],
              paymentDate: '2025-12-05',
              totalPaymentPence: 6800
            }
          ]
        }
      })
    })

    test('throws Boom errors (from h.response) through to error handler', () => {
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
        response: () => {
          throw error
        }
      }

      expect(() => reviewOfferController.handler(request, h)).toThrow(error)
    })
  })
})
