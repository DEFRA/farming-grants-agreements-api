import Boom from '@hapi/boom'

import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'
import { calculatePaymentsBasedOnParcelsWithActions } from '~/src/api/adapter/land-grants-adapter.js'

// Mock the modules
vi.mock('~/src/api/common/helpers/sqs-client.js')
vi.mock(
  '~/src/api/agreement/helpers/get-agreement-data.js',
  async (importOriginal) => {
    const actual = await importOriginal()
    return { __esModule: true, ...actual, getAgreementDataById: vi.fn() }
  }
)
vi.mock('~/src/api/common/helpers/jwt-auth.js')
vi.mock('~/src/api/adapter/land-grants-adapter.js', () => ({
  calculatePaymentsBasedOnParcelsWithActions: vi.fn()
}))

describe('getAgreementController', () => {
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
    vi.clearAllMocks()
    calculatePaymentsBasedOnParcelsWithActions.mockResolvedValue({
      agreementStartDate: '2024-01-01',
      agreementEndDate: '2025-12-31',
      frequency: 'Annual',
      agreementTotalPence: 1000,
      annualTotalPence: 1000,
      parcelItems: [],
      agreementLevelItems: [],
      payments: []
    })

    // Setup default mock implementations
    vi.spyOn(agreementDataHelper, 'getAgreementDataById')
    vi.spyOn(agreementDataHelper, 'getAgreementDataBySbi')
  })

  describe('GET / (by SBI)', () => {
    const doGet = () =>
      server.inject({
        method: 'GET',
        url: '/',
        headers: { 'x-encrypted-auth': 'valid-jwt-token' }
      })

    describe('Farmer', () => {
      beforeEach(() => {
        vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
          valid: true,
          source: 'defra',
          sbi: '106284736'
        })
      })

      describe('not yet accepted', () => {
        const agreementId = 'FPTT123456789'
        let mockAgreementData

        beforeEach(() => {
          mockAgreementData = {
            agreementNumber: agreementId,
            status: 'offered',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: '1', parcelId: '2', actions: [] }]
            },
            payment: {
              agreementStartDate: '2025-12-05',
              annualTotalPence: 0,
              parcelItems: {},
              agreementLevelItems: {}
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataBySbi'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return offered data', async () => {
          const { statusCode, result } = await doGet()
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toContain('offered')
          expect(result.auth.source).toBe('defra')
        })

        test('should handle agreement not found', async () => {
          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataBySbi'
          ).mockRejectedValue(Boom.notFound('Agreement not found'))

          const { statusCode, result } = await doGet()
          expect(statusCode).toBe(404)
          expect(result.errorMessage).toContain('Agreement not found')
        })

        test('should handle database errors', async () => {
          const errorMessage = 'Database connection failed'
          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataBySbi'
          ).mockRejectedValue(new Error(errorMessage))

          const { statusCode, result } = await doGet()
          expect(statusCode).toBe(statusCodes.internalServerError)
          expect(result.errorMessage).toContain('Database connection failed')
        })

        test('should fetch updated payments when status is offered', async () => {
          const { result } = await doGet()

          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).toHaveBeenCalledWith(
            mockAgreementData.application.parcel,
            expect.objectContaining({
              info: expect.any(Function)
            })
          )
          expect(result.agreementData.payment).toEqual(
            expect.objectContaining({
              agreementStartDate: '2024-01-01',
              agreementEndDate: '2025-12-31'
            })
          )
          expect(result.auth.source).toBe('defra')
        })
      })

      describe('already accepted', () => {
        /** @type {Agreement} */
        let mockAgreementData

        beforeEach(() => {
          mockAgreementData = {
            agreementNumber: 'FPTT123456789',
            status: 'accepted',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: '1', parcelId: '2', actions: [] }]
            },
            payment: {
              agreementStartDate: '2025-12-05',
              annualTotalPence: 0,
              parcelItems: {},
              agreementLevelItems: {}
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataBySbi'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return accepted data', async () => {
          const { statusCode, result } = await doGet()
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toContain('accepted')
          expect(result.auth.source).toBe('defra')
        })

        test('should not recalculate payments when already accepted', async () => {
          await doGet()
          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).not.toHaveBeenCalled()
        })
      })

      describe('withdrawn', () => {
        let mockAgreementData

        beforeEach(() => {
          mockAgreementData = {
            agreementNumber: 'FPTT123456789',
            status: 'withdrawn',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: '1', parcelId: '2', actions: [] }]
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataBySbi'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return withdrawn data', async () => {
          const { statusCode, result } = await doGet()
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toBe('withdrawn')
          expect(result.auth.source).toBe('defra')
        })

        test('should fetch updated payments when status is withdrawn and payment does not exist', async () => {
          const { result } = await doGet()

          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).toHaveBeenCalledWith(
            mockAgreementData.application.parcel,
            expect.objectContaining({
              info: expect.any(Function)
            })
          )
          expect(result.agreementData.payment).toEqual(
            expect.objectContaining({
              agreementStartDate: '2024-01-01',
              agreementEndDate: '2025-12-31'
            })
          )
          expect(result.auth.source).toBe('defra')
        })

        test('should not recalculate payments when status is withdrawn and payment exists', async () => {
          mockAgreementData.payment = {
            agreementStartDate: '2025-12-05',
            annualTotalPence: 0,
            parcelItems: {},
            agreementLevelItems: {}
          }

          const { result } = await doGet()

          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).not.toHaveBeenCalled()
          expect(result.agreementData.payment).toEqual(
            mockAgreementData.payment
          )
          expect(result.auth.source).toBe('defra')
        })
      })
    })

    describe('Case worker', () => {
      beforeEach(() => {
        vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
          valid: true,
          source: 'entra'
        })

        const mockAgreementData = {
          agreementNumber: 'FPTT123456789',
          status: 'offered',
          sbi: '106284736',
          application: { parcel: [] },
          payment: {
            agreementStartDate: '2025-12-05',
            annualTotalPence: 0,
            parcelItems: {},
            agreementLevelItems: {}
          }
        }

        vi.spyOn(
          agreementDataHelper,
          'getAgreementDataBySbi'
        ).mockResolvedValue(mockAgreementData)
      })

      test('should be forbidden', async () => {
        const { statusCode, result } = await doGet()
        expect(statusCode).toBe(401)
        expect(result.errorMessage).toContain(
          'Not allowed to view the agreement. Source: entra'
        )
      })
    })
  })

  describe('GET /{agreementId}', () => {
    const doGet = (agreementId = 'FPTT123456789', headers = {}) =>
      server.inject({
        method: 'GET',
        url: `/${agreementId}`,
        headers: { 'x-encrypted-auth': 'valid-jwt-token', ...headers }
      })

    describe('Farmer', () => {
      const agreementId = 'FPTT123456789'

      beforeEach(() => {
        vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
          valid: true,
          source: 'defra',
          sbi: '106284736'
        })
      })

      describe('not yet accepted', () => {
        beforeEach(() => {
          const mockAgreementData = {
            agreementNumber: agreementId,
            status: 'offered',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: 'sheet', parcelId: '1', actions: [] }]
            },
            payment: {
              agreementStartDate: '2025-12-05',
              annualTotalPence: 0,
              parcelItems: {},
              agreementLevelItems: {}
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataById'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return offered data', async () => {
          const { statusCode, result } = await doGet(agreementId)
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toContain('offered')
          expect(result.auth.source).toBe('defra')
        })

        test('should handle agreement not found', async () => {
          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataById'
          ).mockRejectedValue(Boom.notFound('Agreement not found'))

          const { statusCode, result } = await doGet('INVALID123')
          expect(statusCode).toBe(404)
          expect(result.errorMessage).toContain('Agreement not found')
        })

        test('should handle database errors', async () => {
          const errorMessage = 'Database connection failed'
          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataById'
          ).mockRejectedValue(new Error(errorMessage))

          const { statusCode, result } = await doGet(agreementId)
          expect(statusCode).toBe(statusCodes.internalServerError)
          expect(result.errorMessage).toContain('Database connection failed')
        })
      })

      describe('already accepted', () => {
        beforeEach(() => {
          const mockAgreementData = {
            agreementNumber: agreementId,
            status: 'accepted',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: 'sheet', parcelId: '1', actions: [] }]
            },
            payment: {
              agreementStartDate: '2025-12-05',
              annualTotalPence: 0,
              parcelItems: {},
              agreementLevelItems: {}
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataById'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return accepted data', async () => {
          const { statusCode, result } = await doGet(agreementId)
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toContain('accepted')
          expect(result.auth.source).toBe('defra')
        })

        test('should return accepted agreement data with base URL when already accepted', async () => {
          const { statusCode, result } = await doGet(agreementId, {
            'x-base-url': '/agreement'
          })
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toContain('accepted')
          expect(result.auth.source).toBe('defra')
        })
      })

      describe('withdrawn', () => {
        let mockAgreementData

        beforeEach(() => {
          mockAgreementData = {
            agreementNumber: agreementId,
            status: 'withdrawn',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: 'sheet', parcelId: '1', actions: [] }]
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataById'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return withdrawn data', async () => {
          const { statusCode, result } = await doGet(agreementId)
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toBe('withdrawn')
          expect(result.auth.source).toBe('defra')
        })

        test('should fetch updated payments when status is withdrawn and payment does not exist', async () => {
          const { result } = await doGet(agreementId)

          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).toHaveBeenCalledWith(
            mockAgreementData.application.parcel,
            expect.objectContaining({
              info: expect.any(Function)
            })
          )
          expect(result.agreementData.payment).toEqual(
            expect.objectContaining({
              agreementStartDate: '2024-01-01',
              agreementEndDate: '2025-12-31'
            })
          )
          expect(result.auth.source).toBe('defra')
        })

        test('should not recalculate payments when status is withdrawn and payment exists', async () => {
          mockAgreementData.payment = {
            agreementStartDate: '2025-12-05',
            annualTotalPence: 0,
            parcelItems: {},
            agreementLevelItems: {}
          }

          const { result } = await doGet(agreementId)

          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).not.toHaveBeenCalled()
          expect(result.agreementData.payment).toEqual(
            mockAgreementData.payment
          )
          expect(result.auth.source).toBe('defra')
        })
      })
    })

    describe('Case worker', () => {
      beforeEach(() => {
        vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
          valid: true,
          source: 'entra'
        })

        const mockAgreementData = {
          agreementNumber: 'FPTT123456789',
          status: 'offered',
          sbi: '106284736',
          application: { parcel: [] },
          payment: {
            agreementStartDate: '2025-12-05',
            annualTotalPence: 0,
            parcelItems: {},
            agreementLevelItems: {}
          }
        }

        vi.spyOn(agreementDataHelper, 'getAgreementDataById').mockResolvedValue(
          mockAgreementData
        )
      })

      test('should return agreement data', async () => {
        const { statusCode, result } = await doGet('FPTT123456789')
        expect(statusCode).toBe(statusCodes.ok)
        expect(result.agreementData.status).toContain('offered')
        expect(result.auth.source).toBe('entra')
      })
    })
  })
})

// Mock the modules
vi.mock('~/src/api/common/helpers/sqs-client.js')
vi.mock(
  '~/src/api/agreement/helpers/get-agreement-data.js',
  async (importOriginal) => {
    const actual = await importOriginal()
    return { __esModule: true, ...actual, getAgreementDataById: vi.fn() }
  }
)
vi.mock('~/src/api/common/helpers/jwt-auth.js')
vi.mock('~/src/api/adapter/land-grants-adapter.js', () => ({
  calculatePaymentsBasedOnParcelsWithActions: vi.fn()
}))

describe('getAgreementController', () => {
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
    vi.clearAllMocks()
    calculatePaymentsBasedOnParcelsWithActions.mockResolvedValue({
      agreementStartDate: '2024-01-01',
      agreementEndDate: '2025-12-31',
      frequency: 'Annual',
      agreementTotalPence: 1000,
      annualTotalPence: 1000,
      parcelItems: [],
      agreementLevelItems: [],
      payments: []
    })

    // Setup default mock implementations
    vi.spyOn(agreementDataHelper, 'getAgreementDataById')
    vi.spyOn(agreementDataHelper, 'getAgreementDataBySbi')
  })

  describe('GET / (by SBI)', () => {
    const doGet = () =>
      server.inject({
        method: 'GET',
        url: '/',
        headers: { 'x-encrypted-auth': 'valid-jwt-token' }
      })

    describe('Farmer', () => {
      beforeEach(() => {
        vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
          valid: true,
          source: 'defra',
          sbi: '106284736'
        })
      })

      describe('not yet accepted', () => {
        const agreementId = 'FPTT123456789'
        let mockAgreementData

        beforeEach(() => {
          mockAgreementData = {
            agreementNumber: agreementId,
            status: 'offered',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: '1', parcelId: '2', actions: [] }]
            },
            payment: {
              agreementStartDate: '2025-12-05',
              annualTotalPence: 0,
              parcelItems: {},
              agreementLevelItems: {}
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataBySbi'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return offered data', async () => {
          const { statusCode, result } = await doGet()
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toContain('offered')
          expect(result.auth.source).toBe('defra')
        })

        test('should handle agreement not found', async () => {
          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataBySbi'
          ).mockRejectedValue(Boom.notFound('Agreement not found'))

          const { statusCode, result } = await doGet()
          expect(statusCode).toBe(404)
          expect(result.errorMessage).toContain('Agreement not found')
        })

        test('should handle database errors', async () => {
          const errorMessage = 'Database connection failed'
          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataBySbi'
          ).mockRejectedValue(new Error(errorMessage))

          const { statusCode, result } = await doGet()
          expect(statusCode).toBe(statusCodes.internalServerError)
          expect(result.errorMessage).toContain('Database connection failed')
        })

        test('should fetch updated payments when status is offered', async () => {
          const { result } = await doGet()

          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).toHaveBeenCalledWith(
            mockAgreementData.application.parcel,
            expect.objectContaining({
              info: expect.any(Function)
            })
          )
          expect(result.agreementData.payment).toEqual(
            expect.objectContaining({
              agreementStartDate: '2024-01-01',
              agreementEndDate: '2025-12-31'
            })
          )
          expect(result.auth.source).toBe('defra')
        })
      })

      describe('already accepted', () => {
        /** @type {Agreement} */
        let mockAgreementData

        beforeEach(() => {
          mockAgreementData = {
            agreementNumber: 'FPTT123456789',
            status: 'accepted',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: '1', parcelId: '2', actions: [] }]
            },
            payment: {
              agreementStartDate: '2025-12-05',
              annualTotalPence: 0,
              parcelItems: {},
              agreementLevelItems: {}
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataBySbi'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return accepted data', async () => {
          const { statusCode, result } = await doGet()
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toContain('accepted')
          expect(result.auth.source).toBe('defra')
        })

        test('should not recalculate payments when already accepted', async () => {
          await doGet()
          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).not.toHaveBeenCalled()
        })
      })

      describe('withdrawn', () => {
        let mockAgreementData

        beforeEach(() => {
          mockAgreementData = {
            agreementNumber: 'FPTT123456789',
            status: 'withdrawn',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: '1', parcelId: '2', actions: [] }]
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataBySbi'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return withdrawn data', async () => {
          const { statusCode, result } = await doGet()
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toBe('withdrawn')
          expect(result.auth.source).toBe('defra')
        })

        test('should fetch updated payments when status is withdrawn and payment does not exist', async () => {
          const { result } = await doGet()

          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).toHaveBeenCalledWith(
            mockAgreementData.application.parcel,
            expect.objectContaining({
              info: expect.any(Function)
            })
          )
          expect(result.agreementData.payment).toEqual(
            expect.objectContaining({
              agreementStartDate: '2024-01-01',
              agreementEndDate: '2025-12-31'
            })
          )
          expect(result.auth.source).toBe('defra')
        })

        test('should not recalculate payments when status is withdrawn and payment exists', async () => {
          mockAgreementData.payment = {
            agreementStartDate: '2025-12-05',
            annualTotalPence: 0,
            parcelItems: {},
            agreementLevelItems: {}
          }

          const { result } = await doGet()

          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).not.toHaveBeenCalled()
          expect(result.agreementData.payment).toEqual(
            mockAgreementData.payment
          )
          expect(result.auth.source).toBe('defra')
        })
      })
    })

    describe('Case worker', () => {
      beforeEach(() => {
        vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
          valid: true,
          source: 'entra'
        })

        const mockAgreementData = {
          agreementNumber: 'FPTT123456789',
          status: 'offered',
          sbi: '106284736',
          application: { parcel: [] },
          payment: {
            agreementStartDate: '2025-12-05',
            annualTotalPence: 0,
            parcelItems: {},
            agreementLevelItems: {}
          }
        }

        vi.spyOn(
          agreementDataHelper,
          'getAgreementDataBySbi'
        ).mockResolvedValue(mockAgreementData)
      })

      test('should be forbidden', async () => {
        const { statusCode, result } = await doGet()
        expect(statusCode).toBe(401)
        expect(result.errorMessage).toContain(
          'Not allowed to view the agreement. Source: entra'
        )
      })
    })
  })

  describe('GET /{agreementId}', () => {
    const doGet = (agreementId = 'FPTT123456789', headers = {}) =>
      server.inject({
        method: 'GET',
        url: `/${agreementId}`,
        headers: { 'x-encrypted-auth': 'valid-jwt-token', ...headers }
      })

    describe('Farmer', () => {
      const agreementId = 'FPTT123456789'

      beforeEach(() => {
        vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
          valid: true,
          source: 'defra',
          sbi: '106284736'
        })
      })

      describe('not yet accepted', () => {
        beforeEach(() => {
          const mockAgreementData = {
            agreementNumber: agreementId,
            status: 'offered',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: 'sheet', parcelId: '1', actions: [] }]
            },
            payment: {
              agreementStartDate: '2025-12-05',
              annualTotalPence: 0,
              parcelItems: {},
              agreementLevelItems: {}
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataById'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return offered data', async () => {
          const { statusCode, result } = await doGet(agreementId)
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toContain('offered')
          expect(result.auth.source).toBe('defra')
        })

        test('should handle agreement not found', async () => {
          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataById'
          ).mockRejectedValue(Boom.notFound('Agreement not found'))

          const { statusCode, result } = await doGet('INVALID123')
          expect(statusCode).toBe(404)
          expect(result.errorMessage).toContain('Agreement not found')
        })

        test('should handle database errors', async () => {
          const errorMessage = 'Database connection failed'
          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataById'
          ).mockRejectedValue(new Error(errorMessage))

          const { statusCode, result } = await doGet(agreementId)
          expect(statusCode).toBe(statusCodes.internalServerError)
          expect(result.errorMessage).toContain('Database connection failed')
        })
      })

      describe('already accepted', () => {
        beforeEach(() => {
          const mockAgreementData = {
            agreementNumber: agreementId,
            status: 'accepted',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: 'sheet', parcelId: '1', actions: [] }]
            },
            payment: {
              agreementStartDate: '2025-12-05',
              annualTotalPence: 0,
              parcelItems: {},
              agreementLevelItems: {}
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataById'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return accepted data', async () => {
          const { statusCode, result } = await doGet(agreementId)
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toContain('accepted')
          expect(result.auth.source).toBe('defra')
        })

        test('should return accepted agreement data with base URL when already accepted', async () => {
          const { statusCode, result } = await doGet(agreementId, {
            'x-base-url': '/agreement'
          })
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toContain('accepted')
          expect(result.auth.source).toBe('defra')
        })
      })

      describe('withdrawn', () => {
        let mockAgreementData

        beforeEach(() => {
          mockAgreementData = {
            agreementNumber: agreementId,
            status: 'withdrawn',
            sbi: '106284736',
            application: {
              parcel: [{ sheetId: 'sheet', parcelId: '1', actions: [] }]
            }
          }

          vi.spyOn(
            agreementDataHelper,
            'getAgreementDataById'
          ).mockResolvedValue(mockAgreementData)
        })

        test('should return withdrawn data', async () => {
          const { statusCode, result } = await doGet(agreementId)
          expect(statusCode).toBe(statusCodes.ok)
          expect(result.agreementData.status).toBe('withdrawn')
          expect(result.auth.source).toBe('defra')
        })

        test('should fetch updated payments when status is withdrawn and payment does not exist', async () => {
          const { result } = await doGet(agreementId)

          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).toHaveBeenCalledWith(
            mockAgreementData.application.parcel,
            expect.objectContaining({
              info: expect.any(Function)
            })
          )
          expect(result.agreementData.payment).toEqual(
            expect.objectContaining({
              agreementStartDate: '2024-01-01',
              agreementEndDate: '2025-12-31'
            })
          )
          expect(result.auth.source).toBe('defra')
        })

        test('should not recalculate payments when status is withdrawn and payment exists', async () => {
          mockAgreementData.payment = {
            agreementStartDate: '2025-12-05',
            annualTotalPence: 0,
            parcelItems: {},
            agreementLevelItems: {}
          }

          const { result } = await doGet(agreementId)

          expect(
            calculatePaymentsBasedOnParcelsWithActions
          ).not.toHaveBeenCalled()
          expect(result.agreementData.payment).toEqual(
            mockAgreementData.payment
          )
          expect(result.auth.source).toBe('defra')
        })
      })
    })

    describe('Case worker', () => {
      beforeEach(() => {
        vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
          valid: true,
          source: 'entra'
        })

        const mockAgreementData = {
          agreementNumber: 'FPTT123456789',
          status: 'offered',
          sbi: '106284736',
          application: { parcel: [] },
          payment: {
            agreementStartDate: '2025-12-05',
            annualTotalPence: 0,
            parcelItems: {},
            agreementLevelItems: {}
          }
        }

        vi.spyOn(agreementDataHelper, 'getAgreementDataById').mockResolvedValue(
          mockAgreementData
        )
      })

      test('should return agreement data', async () => {
        const { statusCode, result } = await doGet('FPTT123456789')
        expect(statusCode).toBe(statusCodes.ok)
        expect(result.agreementData.status).toContain('offered')
        expect(result.auth.source).toBe('entra')
      })
    })
  })
})

/**
 * @typedef {import('~/src/api/common/types/agreement.d.js').Agreement} Agreement
 */
