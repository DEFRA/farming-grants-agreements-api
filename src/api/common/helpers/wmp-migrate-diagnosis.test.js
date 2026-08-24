import { vi, describe, it, expect, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import { mockClient } from 'aws-sdk-client-mock'
import { ObjectId, Decimal128 } from 'mongodb'
import { config } from '#~/config/index.js'

// Import the module after mocking the logger
import { runAgreementDataDiagnosis } from './wmp-migrate-diagnosis.js'

import { injectUnhappyData } from './wmp-sample-data-injector.js'
import countersModel from '#~/api/common/models/counters.js'

vi.mock('#~/api/common/models/counters.js', () => ({
  default: {
    findOne: vi.fn()
  }
}))

vi.mock('./wmp-sample-data-injector.js', () => ({
  injectSampleWMPData: vi.fn(() => {
    // eslint-disable-next-line no-console
    console.log('Successfully injected happy path Woodland data.')
  }),
  injectUnhappyData: vi.fn(() => {
    mockLogger.info('Successfully injected unhappy path data.')
  })
}))

// Hoist the mock instance so it's available in vi.mock
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('#~/api/common/helpers/logging/logger.js', () => ({
  createLogger: () => mockLogger
}))

const s3Mock = mockClient(S3Client)

describe('wmp-migrate-diagnosis.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    s3Mock.reset()
    // Reset config implementation for each test
    vi.spyOn(config, 'get').mockRestore()

    // Default mock for countersModel.findOne
    countersModel.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'claimIds', seq: 123 })
    })
  })

  describe('runAgreementDataDiagnosis', () => {
    it('should do nothing if wmpMigrationDiagnosis flag is false', async () => {
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return false
        return true
      })
      await runAgreementDataDiagnosis()
      expect(mockLogger.info).not.toHaveBeenCalled()
    })

    it('should run diagnosis if flag is true', async () => {
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        if (key === 'mongoUri') return 'mongodb://localhost:27017'
        if (key === 'mongoDatabase') return 'test'
        return true
      })

      const record = {
        grantInfo: { agreementNumber: 'WMP001' },
        clientRef: 'ref001',
        status: 'accepted',
        createdAt: new Date(),
        identifiers: { sbi: '123' },
        application: { parcel: [] }
      }

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record
        }
      }

      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })

      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('WMP Migration Diagnostic Report')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Current claimIds counter sequence: 123')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Total Versions Inspected: 1')
      )
    })

    it('should inject unhappy data if flag is true', async () => {
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return true
        return 'test'
      })

      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      const mockCollection = {
        findOne: vi.fn().mockResolvedValue(null),
        insertOne: vi.fn().mockResolvedValue({}),
        insertMany: vi.fn().mockResolvedValue({}),
        updateOne: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({}),
        deleteOne: vi.fn().mockResolvedValue({}),
        aggregate: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
          }
        })
      }
      vi.spyOn(mongoose.connection, 'collection').mockReturnValue(
        mockCollection
      )

      await runAgreementDataDiagnosis()

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully injected unhappy path data.'
      )
    })

    it('should handle injection cleanup of existing grant', async () => {
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return true
        return 'test'
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      const mockCollection = {
        aggregate: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
          }
        })
      }
      vi.spyOn(mongoose.connection, 'collection').mockReturnValue(
        mockCollection
      )

      await runAgreementDataDiagnosis()
      expect(injectUnhappyData).toHaveBeenCalled()
    })

    it('should handle database connection if not connected', async () => {
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        return 'test'
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 0,
        configurable: true
      })
      const connectSpy = vi
        .spyOn(mongoose, 'connect')
        .mockResolvedValue(undefined)

      vi.spyOn(mongoose.connection, 'collection').mockReturnValue({
        aggregate: () => ({
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve()
          }
        })
      })

      await runAgreementDataDiagnosis()
      expect(connectSpy).toHaveBeenCalled()
    })

    it('should handle errors in runWMPAgreementDataDiagnosis', async () => {
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        return 'test'
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })
      vi.spyOn(mongoose.connection, 'collection').mockImplementation(() => {
        throw new Error('Database error')
      })

      await runAgreementDataDiagnosis()
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Diagnostic failed with error:'
      )
    })
  })

  describe('Validation Logic', () => {
    it('should report failure for missing SBI and clientRef', async () => {
      const record = {
        _id: new ObjectId(),
        grantInfo: { agreementNumber: 'WMP001' },
        createdAt: new Date(),
        identifiers: { sbi: null },
        application: { parcel: [] }
      }

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        return 'test'
      })

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record
        }
      }
      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[FAIL] agreement=WMP001')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('path=clientRef reason=MISSING_FIELD')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('path=identifiers.sbi reason=MISSING_FIELD')
      )
    })

    it('should report failure for invalid parcel ID', async () => {
      const record = {
        grantInfo: { agreementNumber: 'WMP001' },
        clientRef: 'ref001',
        createdAt: new Date(),
        identifiers: { sbi: '123' },
        application: {
          parcel: [{ parcelId: 'INVALID' }]
        }
      }

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        return 'test'
      })

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record
        }
      }
      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'path=values.parcels[0].id reason=PARCEL_ID_UNPARSEABLE'
        )
      )
    })

    it('should report failure for total amount mismatch', async () => {
      const record = {
        grantInfo: { agreementNumber: 'WMP001' },
        clientRef: 'ref-mismatch',
        createdAt: new Date(),
        identifiers: { sbi: '123' },
        payment: { agreementTotalPence: 1000 },
        application: { parcel: [] }
      }

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        return 'test'
      })

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record
        }
      }
      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'path=values.totalAmountPence reason=TOTAL_MISMATCH'
        )
      )
    })

    it('should handle unexpected error during validation', async () => {
      const record = {
        grantInfo: { agreementNumber: 'WMP001' },
        clientRef: 'ref001',
        createdAt: new Date(),
        identifiers: { sbi: '123' },
        application: {
          get parcel() {
            throw new Error('Unexpected validation error')
          }
        }
      }

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        return 'test'
      })

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record
        }
      }
      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('path=diagnostic reason=UNEXPECTED_ERROR')
      )
    })
  })

  describe('S3 and PDF checks', () => {
    it('should report failure if PDF path contains non-existent', async () => {
      const record = {
        grantInfo: { agreementNumber: 'WMP001' },
        clientRef: 'ref001',
        createdAt: new Date(),
        identifiers: { sbi: '123' },
        documents: {
          doc1: { path: '/some/non-existent/path.pdf' }
        }
      }

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        return 'test'
      })

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record
        }
      }
      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('path=documents.doc1 reason=PDF_MISSING')
      )
    })

    it('should verify S3 object successfully', async () => {
      const record = {
        grantInfo: { agreementNumber: 'WMP001' },
        clientRef: 'ref001',
        createdAt: new Date(),
        identifiers: { sbi: '123' },
        documents: {
          doc1: { path: 's3://my-bucket/path/to/file.pdf' }
        }
      }

      s3Mock.on(HeadObjectCommand).resolves({})

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        return 'test'
      })

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record
        }
      }
      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[PASS] agreement=WMP001')
      )
    })

    it('should report failure if S3 object is missing (404)', async () => {
      const record = {
        grantInfo: { agreementNumber: 'WMP001' },
        clientRef: 'ref001',
        createdAt: new Date(),
        identifiers: { sbi: '123' },
        documents: {
          doc1: { path: 's3://my-bucket/path/to/file.pdf' }
        }
      }

      const error = new Error('Not Found')
      error.name = 'NotFound'
      s3Mock.on(HeadObjectCommand).rejects(error)

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        return 'test'
      })

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record
        }
      }
      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('path=documents.doc1 reason=PDF_MISSING')
      )
    })

    it('should report failure if S3 object is unreadable (other error)', async () => {
      const record = {
        grantInfo: { agreementNumber: 'WMP001' },
        clientRef: 'ref001',
        createdAt: new Date(),
        identifiers: { sbi: '123' },
        documents: {
          doc1: { path: 's3://my-bucket/path/to/file.pdf' }
        }
      }

      const error = new Error('Access Denied')
      error.name = 'Forbidden'
      s3Mock.on(HeadObjectCommand).rejects(error)

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        return 'test'
      })

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record
        }
      }
      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('path=documents.doc1 reason=PDF_UNREADABLE')
      )
    })
  })

  describe('Version ordering', () => {
    it('should report failure if version sequence is invalid', async () => {
      const date1 = new Date('2026-01-02')
      const date2 = new Date('2026-01-01') // earlier than date1

      const record1 = {
        grantInfo: { agreementNumber: 'WMP001' },
        clientRef: 'ref001',
        createdAt: date1,
        identifiers: { sbi: '123' },
        application: { parcel: [] }
      }
      const record2 = {
        grantInfo: { agreementNumber: 'WMP001' },
        clientRef: 'ref002',
        createdAt: date2,
        identifiers: { sbi: '123' },
        application: { parcel: [] }
      }

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        return 'test'
      })

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record1
          yield record2
        }
      }
      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'path=version_ordering reason=VERSION_SEQUENCE_INVALID'
        )
      )
    })
  })

  describe('createCandidate Decimal128 handling', () => {
    it('should handle Decimal128 in action quantity', async () => {
      const record = {
        grantInfo: { agreementNumber: 'WMP001' },
        clientRef: 'ref001',
        createdAt: new Date(),
        identifiers: { sbi: '123' },
        application: {
          parcel: [
            {
              parcelId: 'ST1234-5678',
              actions: [
                {
                  code: 'PA3',
                  appliedFor: { quantity: Decimal128.fromString('10.5') }
                }
              ]
            }
          ]
        }
      }

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        return 'test'
      })

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record
        }
      }
      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[PASS]')
      )
    })
  })

  describe('S3 and PDF checks extra', () => {
    it('should skip non-S3 path', async () => {
      const record = {
        grantInfo: { agreementNumber: 'WMP_NOS3' },
        clientRef: 'ref_nos3',
        createdAt: new Date(),
        identifiers: { sbi: '123' },
        application: { parcel: [] },
        documents: {
          doc1: { path: 'file://local/path/to/pdf.pdf' }
        }
      }

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.wmpMigrationDiagnosis') return true
        if (key === 'featureFlags.injectUnHappyWMPData') return false
        return 'test'
      })

      const mockAggregate = {
        [Symbol.asyncIterator]: async function* () {
          await Promise.resolve()
          yield record
        }
      }
      vi.spyOn(mongoose.connection, 'collection').mockImplementation((name) => {
        if (name === 'versions') return { aggregate: () => mockAggregate }
        return {}
      })
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      await runAgreementDataDiagnosis()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Skipping non-S3 path: file://local/path/to/pdf.pdf'
        )
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[PASS]')
      )
    })
  })
})
