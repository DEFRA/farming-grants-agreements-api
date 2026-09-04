import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkWmpAgreementsPdf,
  runWMPAgreementDataAnalysis
} from '#~/api/common/helpers/wmp-migration-analysis.js'

vi.mock('#~/api/common/helpers/s3-client.js', () => ({
  checkFileExists: vi.fn()
}))

vi.mock('#~/api/common/helpers/retention-period.js', () => ({
  getRetentionPrefix: vi.fn()
}))

const { checkFileExists } = await import('#~/api/common/helpers/s3-client.js')
const { getRetentionPrefix } = await import(
  '#~/api/common/helpers/retention-period.js'
)

vi.mock('#~/api/common/helpers/logging/logger.js', () => {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
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
      if (key === 'files.s3.bucket') return 'test-bucket'
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
          code: 'woodland',
          clientRef: 'CR1',
          correlationId: 'CORR1',
          identifiers: { sbi: 'sbi', frn: 'frn', crn: 'crn' },
          scheme: 'WMP',
          name: 'N1',
          applicant: {
            business: { name: 'B1', address: { line1: 'L1' } },
            customer: { name: { first: 'F', last: 'L' } }
          },
          application: {
            parcel: [
              {
                parcelId: 'P1',
                area: { unit: 'ha', quantity: 1 },
                actions: [
                  {
                    code: 'A1',
                    version: '1',
                    durationYears: 1,
                    appliedFor: { unit: 'ha', quantity: 1 }
                  }
                ]
              }
            ],
            agreement: [
              {
                code: 'AG1',
                description: 'D1',
                durationYears: 1,
                paymentRates: 1,
                annualPaymentPence: 1
              }
            ]
          },
          status: 'accepted',
          payment: {
            agreementStartDate: '2023-01-01',
            agreementEndDate: '2023-12-31',
            annualTotalPence: 0,
            agreementTotalPence: 0,
            payments: [
              { totalPaymentPence: 0, correlationId: 'C1', lineItems: [] }
            ]
          },
          actionApplications: [
            {
              code: 'A1',
              sheetId: 'S1',
              parcelId: 'P1',
              appliedFor: { unit: 'ha', quantity: 1 }
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          signatureDate: '2023-01-01'
        }
      ]

      const mockCollection = {
        aggregate: vi.fn(() => ({
          [Symbol.asyncIterator]: function* () {
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

      expect(mockCollection.find).toHaveBeenCalledWith({
        grant: { $in: ['grant1'] }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WMP_MIGRATION migration=GOOD agreement=WMP001 agreementId=agreement1 agreementStatus=accepted versions=1 wmpVersions=1 versionTypes=woodland/WMP:1 versionStatuses=accepted:1 issues=none'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WMP_MIGRATION_SUMMARY agreements=1 good=1 bad=0 decision=GOOD'
      )
      expect(
        mockLogger.info.mock.calls.filter(([message]) =>
          message.startsWith('WMP_MIGRATION migration=')
        )
      ).toHaveLength(1)
    })

    it('should flag non-WMP versions linked to a WMP agreement', async () => {
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
          _id: { toString: () => 'wmp-version' },
          grant: 'grant1',
          code: 'woodland',
          scheme: 'WMP',
          status: 'accepted'
        },
        {
          _id: { toString: () => 'sfi-version' },
          grant: 'grant1',
          code: 'frps-private-beta',
          scheme: 'SFI',
          status: 'accepted'
        }
      ]
      const mockCollection = {
        aggregate: vi.fn(() => ({
          [Symbol.asyncIterator]: function* () {
            yield mockAgreements[0]
          }
        })),
        find: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue(mockVersions)
        }))
      }
      mockMongoose.connection.collection.mockReturnValue(mockCollection)

      await runWMPAgreementDataAnalysis()

      const agreementLog = mockLogger.info.mock.calls
        .map(([message]) => message)
        .find((message) => message.startsWith('WMP_MIGRATION migration='))
      expect(agreementLog).toContain('migration=BAD')
      expect(agreementLog).toContain(
        'versions=2 wmpVersions=1 versionTypes=woodland/WMP:1,frps-private-beta/SFI:1'
      )
      expect(agreementLog).toContain(
        'NON_WMP_VERSION_LINKED:versions@sfi-version'
      )
      expect(agreementLog.match(/sfi-version/g)).toHaveLength(1)
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
          [Symbol.asyncIterator]: function* () {
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
        expect.stringContaining('WMP_MIGRATION migration=BAD agreement=WMP001')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('issues=MISSING_GRANTS:grantDetails@agreement')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WMP_MIGRATION_SUMMARY agreements=1 good=0 bad=1 decision=BAD'
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
          code: 'woodland',
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
            payments: [
              { totalPaymentPence: 1000, correlationId: 'C1', lineItems: [] }
            ]
          },
          actionApplications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          signatureDate: '2023-01-01'
        }
      ]

      const mockCollection = {
        aggregate: vi.fn(() => ({
          [Symbol.asyncIterator]: function* () {
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
        expect.stringContaining('INVALID_PAYMENT_VALUES:payment@version1')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WMP_MIGRATION_SUMMARY agreements=1 good=0 bad=1 decision=BAD'
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
          scheme: 'WMP',
          payment: {
            agreementStartDate: '2023-01-01',
            agreementEndDate: '2023-12-31',
            annualTotalPence: 1000,
            agreementTotalPence: 1000,
            payments: [
              { totalPaymentPence: 3000, correlationId: 'C1', lineItems: [] }
            ]
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
        expect.stringContaining('INVALID_PAYMENT_VALUES:payment@v1')
      )
    })

    it('should report failure when grantDetails is empty (MISSING_GRANTS)', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'agreement_no_grants' },
          agreementNumber: 'WMP-NO-GRANTS',
          status: 'accepted',
          grantDetails: []
        }
      ]

      const mockCollection = {
        aggregate: vi.fn(() => ({
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
            yield mockAgreements[0]
          }
        })),
        find: vi.fn()
      }

      mockMongoose.connection.collection.mockReturnValue(mockCollection)

      await runWMPAgreementDataAnalysis()

      expect(mockLogger.info).toHaveBeenCalledWith(
        'WMP_MIGRATION migration=BAD agreement=WMP-NO-GRANTS agreementId=agreement_no_grants agreementStatus=accepted versions=0 wmpVersions=0 versionTypes=none versionStatuses=none issues=MISSING_GRANTS:grantDetails@agreement'
      )
    })

    it('should report failure when versions are missing (MISSING_VERSIONS)', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'agreement_no_versions' },
          agreementNumber: 'WMP-NO-VERSIONS',
          status: 'accepted',
          grantDetails: [{ _id: 'grant1' }]
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
          toArray: vi.fn().mockResolvedValue([])
        }))
      }

      mockMongoose.connection.collection.mockReturnValue(mockCollection)

      await runWMPAgreementDataAnalysis()

      expect(mockLogger.info).toHaveBeenCalledWith(
        'WMP_MIGRATION migration=BAD agreement=WMP-NO-VERSIONS agreementId=agreement_no_versions agreementStatus=accepted versions=0 wmpVersions=0 versionTypes=none versionStatuses=none issues=MISSING_VERSIONS:versions@agreement'
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
          scheme: 'WMP',
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
        c.includes('INVALID_PAYMENT_VALUES')
      )
      expect(hasInvalidPaymentValues).toBe(false)
    })

    it('should report failure for empty identifiers object', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'a1' },
          agreementNumber: 'WMP-EMPTY-IDS',
          grantDetails: [{ _id: 'g1' }]
        }
      ]
      const mockVersions = [
        {
          _id: { toString: () => 'v1' },
          grant: 'g1',
          agreementNumber: 'WMP-EMPTY-IDS',
          code: 'woodland',
          clientRef: 'CR1',
          correlationId: 'CORR1',
          identifiers: {}, // EMPTY
          schemeCode: 'S1',
          name: 'N1',
          applicant: {
            business: { name: 'B1', address: { line1: 'L1' } },
            customer: { name: { first: 'F', last: 'L' } }
          },
          application: {
            parcel: [
              {
                parcelId: 'P1',
                area: { unit: 'ha', quantity: 1 },
                actions: [
                  {
                    code: 'A1',
                    version: '1',
                    durationYears: 1,
                    appliedFor: { unit: 'ha', quantity: 1 }
                  }
                ]
              }
            ],
            agreement: [
              {
                code: 'AG1',
                description: 'D1',
                durationYears: 1,
                paymentRates: 1,
                annualPaymentPence: 1
              }
            ]
          },
          status: 'accepted',
          payment: {
            agreementStartDate: '2023-01-01',
            agreementEndDate: '2023-12-31',
            annualTotalPence: 0,
            agreementTotalPence: 0,
            payments: [
              { totalPaymentPence: 0, correlationId: 'C1', lineItems: [] }
            ]
          },
          actionApplications: [
            {
              code: 'A1',
              sheetId: 'S1',
              parcelId: 'P1',
              appliedFor: { unit: 'ha', quantity: 1 }
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          signatureDate: '2023-01-01'
        }
      ]
      const mockCollection = {
        aggregate: vi.fn(() => ({
          [Symbol.asyncIterator]: function* () {
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
        expect.stringContaining('MISSING_PROPERTY:identifiers@v1')
      )
    })

    it('should report failure for empty parcels array', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'a1' },
          agreementNumber: 'WMP-EMPTY-PARCELS',
          grantDetails: [{ _id: 'g1' }]
        }
      ]
      const mockVersions = [
        {
          _id: { toString: () => 'v1' },
          grant: 'g1',
          agreementNumber: 'WMP-EMPTY-PARCELS',
          code: 'woodland',
          clientRef: 'CR1',
          correlationId: 'CORR1',
          identifiers: { sbi: 'sbi', frn: 'frn', crn: 'crn' },
          schemeCode: 'S1',
          name: 'N1',
          applicant: {
            business: { name: 'B1', address: { line1: 'L1' } },
            customer: { name: { first: 'F', last: 'L' } }
          },
          application: {
            parcel: [], // EMPTY
            agreement: [
              {
                code: 'AG1',
                description: 'D1',
                durationYears: 1,
                paymentRates: 1,
                annualPaymentPence: 1
              }
            ]
          },
          status: 'accepted',
          payment: {
            agreementStartDate: '2023-01-01',
            agreementEndDate: '2023-12-31',
            annualTotalPence: 0,
            agreementTotalPence: 0,
            payments: [
              { totalPaymentPence: 0, correlationId: 'C1', lineItems: [] }
            ]
          },
          actionApplications: [
            {
              code: 'A1',
              sheetId: 'S1',
              parcelId: 'P1',
              appliedFor: { unit: 'ha', quantity: 1 }
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          signatureDate: '2023-01-01'
        }
      ]
      const mockCollection = {
        aggregate: vi.fn(() => ({
          [Symbol.asyncIterator]: function* () {
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
        expect.stringContaining('MISSING_PROPERTY:parcels@v1')
      )
    })

    it('should report failure for unmappable status (STATUS_UNMAPPABLE)', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'agreement_unmappable' },
          agreementNumber: 'WMP-UNMAPPABLE',
          status: 'withdrawn',
          grantDetails: [{ _id: 'grant1' }]
        }
      ]

      const mockVersions = [
        {
          _id: { toString: () => 'version1' },
          grant: 'grant1',
          agreementNumber: 'WMP-UNMAPPABLE',
          code: 'woodland',
          clientRef: 'CR1',
          correlationId: 'CORR1',
          identifiers: {},
          schemeCode: 'S1',
          name: 'N1',
          applicant: {},
          application: { parcel: [], agreement: [] },
          status: 'withdrawn',
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
        expect.stringContaining(
          'WMP_MIGRATION migration=BAD agreement=WMP-UNMAPPABLE'
        )
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('STATUS_UNMAPPABLE:status@version1')
      )
    })

    it('should use payment.agreementLevelItems without logging the normal shape', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'agreement_ali' },
          agreementNumber: 'WMP-ALI',
          status: 'accepted',
          grantDetails: [{ _id: 'grant1' }]
        }
      ]

      const mockVersions = [
        {
          _id: { toString: () => 'version1' },
          grant: 'grant1',
          code: 'woodland',
          clientRef: 'CR1',
          correlationId: 'CORR1',
          identifiers: { sbi: 'sbi', frn: 'frn', crn: 'crn' },
          schemeCode: 'S1',
          name: 'N1',
          applicant: {
            business: { name: 'B1', address: { line1: 'L1' } },
            customer: { name: { first: 'F', last: 'L' } }
          },
          application: {
            parcel: [
              {
                parcelId: 'P1',
                area: { unit: 'ha', quantity: 1 },
                actions: []
              }
            ]
          },
          status: 'accepted',
          payment: {
            agreementStartDate: '2023-01-01',
            agreementEndDate: '2023-12-31',
            annualTotalPence: 100,
            agreementTotalPence: 100,
            agreementLevelItems: new Map([
              [
                '1',
                {
                  code: 'ITEM1',
                  description: 'Desc1',
                  version: '1',
                  annualPaymentPence: 100
                }
              ]
            ]),
            payments: [
              { totalPaymentPence: 100, correlationId: 'C1', lineItems: [] }
            ]
          },
          actionApplications: [
            {
              code: 'A1',
              sheetId: 'S1',
              parcelId: 'P1',
              appliedFor: { unit: 'ha', quantity: 1 }
            }
          ],
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
        'WMP_MIGRATION migration=GOOD agreement=WMP-ALI agreementId=agreement_ali agreementStatus=accepted versions=1 wmpVersions=1 versionTypes=woodland/S1:1 versionStatuses=accepted:1 issues=none'
      )
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Found payment.agreementLevelItems')
      )
    })

    it('should report failure when both shapes exist but shared fields mismatch', async () => {
      const mockAgreements = [
        {
          _id: { toString: () => 'agreement_mismatch' },
          agreementNumber: 'WMP-MISMATCH',
          status: 'accepted',
          grantDetails: [{ _id: 'grant1' }]
        }
      ]

      const mockVersions = [
        {
          _id: { toString: () => 'version1' },
          grant: 'grant1',
          agreementNumber: 'WMP-MISMATCH',
          code: 'woodland',
          status: 'accepted',
          payment: {
            agreementLevelItems: new Map([
              [
                '1',
                {
                  code: 'ITEM1',
                  description: 'Desc1',
                  annualPaymentPence: 100
                }
              ]
            ])
          },
          application: {
            agreement: [
              {
                code: 'ITEM1',
                description: 'DIFFERENT',
                annualPaymentPence: 100
              }
            ]
          },
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
        expect.stringContaining('MISSING_PROPERTY:items@version1')
      )
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Shared fields mismatch')
      )
    })
  })

  describe('checkWmpAgreementsPdf', () => {
    it('should skip PDF check if bucket is not set', async () => {
      const { config } = await import('#~/config/index.js')
      vi.mocked(config.get).mockReturnValueOnce(null)

      await checkWmpAgreementsPdf()

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'FILES_S3_BUCKET not set - skipping PDF check'
      )
    })

    it('should process agreements and log PASS when PDF exists', async () => {
      const mockAgreements = [
        {
          agreementNumber: 'WMP001',
          latestAcceptedVersion: {
            version: 1,
            payment: {
              agreementStartDate: '2023-01-01',
              agreementEndDate: '2023-12-31'
            }
          }
        }
      ]

      const mockCollection = {
        aggregate: vi.fn(() => ({
          size: 1,
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
            yield mockAgreements[0]
          }
        }))
      }

      mockMongoose.connection.collection.mockReturnValue(mockCollection)
      vi.mocked(getRetentionPrefix).mockReturnValue('base')
      vi.mocked(checkFileExists).mockResolvedValue(true)

      await checkWmpAgreementsPdf()

      expect(getRetentionPrefix).toHaveBeenCalledWith(
        '2023-01-01',
        '2023-12-31'
      )
      expect(checkFileExists).toHaveBeenCalledWith({
        bucket: 'test-bucket',
        key: 'base/WMP001/1/WMP001-1.pdf'
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WMP_PDF_CHECK_PASS agreement=WMP001 version=1 key=base/WMP001/1/WMP001-1.pdf'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WMP_PDF_CHECK_SUMMARY total_checks=1 passed=1 failed=0'
      )
    })

    it('should log FAIL when PDF does not exist', async () => {
      const mockAgreements = [
        {
          agreementNumber: 'WMP002',
          latestAcceptedVersion: {
            version: 2,
            payment: {
              agreementStartDate: '2023-01-01',
              agreementEndDate: '2023-12-31'
            }
          }
        }
      ]

      const mockCollection = {
        aggregate: vi.fn(() => ({
          size: 1,
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
            yield mockAgreements[0]
          }
        }))
      }

      mockMongoose.connection.collection.mockReturnValue(mockCollection)
      vi.mocked(getRetentionPrefix).mockReturnValue('base')
      vi.mocked(checkFileExists).mockResolvedValue(false)

      await checkWmpAgreementsPdf()

      expect(mockLogger.error).toHaveBeenCalledWith(
        'WMP_PDF_CHECK_FAIL agreement=WMP002 version=2 key=base/WMP002/2/WMP002-2.pdf reason=NOT_FOUND'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WMP_PDF_CHECK_SUMMARY total_checks=1 passed=0 failed=1'
      )
    })

    it('should log FAIL when checkFileExists throws an error', async () => {
      const mockAgreements = [
        {
          agreementNumber: 'WMP003',
          latestAcceptedVersion: {
            version: 1,
            payment: {
              agreementStartDate: '2023-01-01',
              agreementEndDate: '2023-12-31'
            }
          }
        }
      ]

      const mockCollection = {
        aggregate: vi.fn(() => ({
          size: 1,
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
            yield mockAgreements[0]
          }
        }))
      }

      mockMongoose.connection.collection.mockReturnValue(mockCollection)
      vi.mocked(getRetentionPrefix).mockReturnValue('base')
      const s3Error = new Error('S3 connection failed')
      vi.mocked(checkFileExists).mockRejectedValue(s3Error)

      await checkWmpAgreementsPdf()

      expect(mockLogger.error).toHaveBeenCalledWith(
        s3Error,
        'WMP_PDF_CHECK_FAIL agreement=WMP003 version=1 key=base/WMP003/1/WMP003-1.pdf reason=ERROR'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WMP_PDF_CHECK_SUMMARY total_checks=1 passed=0 failed=1'
      )
    })

    it('should handle MongoDB connection failure', async () => {
      mockMongoose.connect.mockRejectedValueOnce(new Error('Mongo error'))
      mockMongoose.connection.readyState = 0

      await checkWmpAgreementsPdf()

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'WMP PDF check failed with error:'
      )
    })
  })
})
