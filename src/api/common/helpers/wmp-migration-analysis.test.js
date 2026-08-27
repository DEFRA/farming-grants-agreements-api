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
          // Minimum properties to pass checkPropertyExists
          agreementNumber: 'WMP001',
          code: 'C1',
          clientRef: 'CR1',
          correlationId: 'CORR1',
          identifiers: {},
          schemeCode: 'S1',
          name: 'N1',
          applicant: {},
          application: {},
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          parcels: [],
          actions: [],
          items: [],
          annualAmountPence: 0,
          totalAmountPence: 0,
          paymentSchedule: '',
          state: 'accepted',
          createdAt: new Date(),
          updatedAt: new Date(),
          acceptedAt: ''
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
  })
})
