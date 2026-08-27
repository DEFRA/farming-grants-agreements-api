import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runWMPAgreementDataAnalysis } from '#~/api/common/helpers/wmp-migration-analysis.js'

vi.mock('#~/api/common/helpers/logging/logger.js', () => {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
  return {
    createLogger: vi.fn(() => logger),
    logger // Exported for access in tests if needed
  }
})

const { createLogger } = await import('#~/api/common/helpers/logging/logger.js')
const mockLogger = createLogger()

vi.mock('mongoose', () => ({
  default: {
    connection: {
      readyState: 1,
      collection: vi.fn()
    },
    connect: vi.fn(),
    ConnectionStates: {
      connected: 1
    }
  }
}))

const mockMongoose = (await import('mongoose')).default

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'mongoUri') return 'mongodb://localhost:27017'
      if (key === 'mongoDatabase') return 'testdb'
      return null
    })
  }
}))

describe('wmp-migration-analysis helper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('runWMPAgreementDataAnalysis', () => {
    it('should complete analysis successfully when all properties are present', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'agreement1' },
          agreementNumber: 'WMP001',
          status: 'accepted',
          grantDetails: [{ _id: 'grant1' }]
        }
      ]

      const mockVersions = [
        {
          _id: { toString: () => 'version1' },
          grant: 'grant1',
          agreementNumber: 'WMP001',
          code: 'C1',
          clientRef: 'CR1',
          correlationId: 'CORR1',
          identifiers: {},
          schemeCode: 'S1',
          name: 'N1',
          applicant: {},
          application: {
            parcel: [],
            agreement: []
          },
          status: 'accepted',
          payment: {
            agreementStartDate: '2023-01-01',
            agreementEndDate: '2023-12-31',
            annualTotalPence: 0,
            agreementTotalPence: 0,
            payments: [{ totalPaymentPence: 0 }]
          },
          actionApplications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          signatureDate: '2023-01-01'
        }
      ]

      const mockCollection = {
        aggregate: vi.fn(() => ({
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
            for (const item of mockAgreements) {
              yield item
            }
          }
        })),
        find: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue(mockVersions)
        }))
      }

      mockMongoose.connection.collection.mockReturnValue(mockCollection)

      await runWMPAgreementDataAnalysis()

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Total Passed: 1')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Go Decision: YES')
      )
    })

    it('should report failures when properties are missing', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'agreement1' },
          agreementNumber: 'WMP001',
          status: 'offered',
          grantDetails: []
        }
      ]

      const mockVersions = [
        {
          _id: { toString: () => 'version1' },
          grant: 'grant1'
        }
      ]

      const mockCollection = {
        aggregate: vi.fn(() => ({
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
            for (const item of mockAgreements) {
              yield item
            }
          }
        })),
        find: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue(mockVersions)
        }))
      }

      mockMongoose.connection.collection.mockReturnValue(mockCollection)

      await runWMPAgreementDataAnalysis()

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Total Failed: 1')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Go Decision: NO')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[FAIL] agreement=WMP001')
      )
    })

    it('should handle errors during analysis', async () => {
      mockMongoose.connection.collection.mockImplementation(() => {
        throw new Error('Database error')
      })

      await runWMPAgreementDataAnalysis()

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Analysis failed with error:'
      )
    })

    it('should report failure when payment values are inconsistent (annual vs agreement)', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'agreement1' },
          agreementNumber: 'WMP001',
          status: 'accepted',
          grantDetails: [{ _id: 'grant1' }]
        }
      ]

      const mockVersions = [
        {
          _id: { toString: () => 'version1' },
          grant: 'grant1',
          agreementNumber: 'WMP001',
          code: 'C1',
          clientRef: 'CR1',
          correlationId: 'CORR1',
          identifiers: {},
          schemeCode: 'S1',
          name: 'N1',
          applicant: {},
          application: {
            parcel: [],
            agreement: []
          },
          status: 'accepted',
          payment: {
            agreementStartDate: '2023-01-01',
            agreementEndDate: '2023-12-31',
            annualTotalPence: 1000,
            agreementTotalPence: 2000,
            payments: [{ totalPaymentPence: 1000 }]
          },
          actionApplications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          signatureDate: '2023-01-01'
        }
      ]

      const mockCollection = {
        aggregate: vi.fn(() => ({
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
            for (const item of mockAgreements) {
              yield item
            }
          }
        })),
        find: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue(mockVersions)
        }))
      }

      mockMongoose.connection.collection.mockReturnValue(mockCollection)

      await runWMPAgreementDataAnalysis()

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Total Failed: 1')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('reason=INVALID_PAYMENT_VALUES')
      )
    })

    it('should report failure when payment values are inconsistent (annual vs first payment)', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'a1' },
          agreementNumber: 'WMP001',
          grantDetails: [{ _id: 'g1' }]
        }
      ]
      const mockVersions = [
        {
          _id: { toString: () => 'v1' },
          grant: 'g1',
          agreementNumber: 'WMP001',
          code: 'C1',
          clientRef: 'CR1',
          correlationId: 'CORR1',
          identifiers: {},
          schemeCode: 'S1',
          name: 'N1',
          applicant: {},
          application: { parcel: [], agreement: [] },
          status: 'accepted',
          payment: {
            agreementStartDate: '2023-01-01',
            agreementEndDate: '2023-12-31',
            annualTotalPence: 1000,
            agreementTotalPence: 1000,
            payments: [{ totalPaymentPence: 3000 }]
          },
          actionApplications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          signatureDate: '2023-01-01'
        }
      ]

      const mockCollection = {
        aggregate: vi.fn(() => ({
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
            yield mockAgreements[0]
          }
        })),
        find: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue(mockVersions)
        }))
      }
      mockMongoose.connection.collection.mockReturnValue(mockCollection)

      await runWMPAgreementDataAnalysis()

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('reason=INVALID_PAYMENT_VALUES')
      )
    })

    it('should not report INVALID_PAYMENT_VALUES if some values are missing', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'a1' },
          agreementNumber: 'WMP001',
          grantDetails: [{ _id: 'g1' }]
        }
      ]
      const mockVersions = [
        {
          _id: { toString: () => 'v1' },
          grant: 'g1',
          agreementNumber: 'WMP001',
          code: 'C1',
          clientRef: 'CR1',
          correlationId: 'CORR1',
          identifiers: {},
          schemeCode: 'S1',
          name: 'N1',
          applicant: {},
          application: { parcel: [], agreement: [] },
          status: 'accepted',
          payment: {
            agreementStartDate: '2023-01-01',
            agreementEndDate: '2023-12-31',
            annualTotalPence: 1000,
            agreementTotalPence: 1000
            // firstPaymentTotalPence is missing
          },
          actionApplications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          signatureDate: '2023-01-01'
        }
      ]

      const mockCollection = {
        aggregate: vi.fn(() => ({
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
            yield mockAgreements[0]
          }
        })),
        find: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue(mockVersions)
        }))
      }
      mockMongoose.connection.collection.mockReturnValue(mockCollection)

      await runWMPAgreementDataAnalysis()

      // Should not find INVALID_PAYMENT_VALUES
      const calls = mockLogger.info.mock.calls.map((c) => c[0])
      const hasInvalidPaymentValues = calls.some((c) =>
        c.includes('reason=INVALID_PAYMENT_VALUES')
      )
      expect(hasInvalidPaymentValues).toBe(false)
    })
  })
})
