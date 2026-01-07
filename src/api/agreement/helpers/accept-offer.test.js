import { vi } from 'vitest'

import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { acceptOffer } from './accept-offer.js'
import { config } from '~/src/config/index.js'
import { calculatePaymentsBasedOnParcelsWithActions } from '~/src/api/adapter/land-grants-adapter.js'

vi.mock('~/src/api/common/models/agreements.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    distinct: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOneAgreementVersion: vi.fn(),
    createAgreementWithVersions: vi.fn()
  }
}))
vi.mock('~/src/config/index.js')
vi.mock('~/src/api/adapter/land-grants-adapter.js', () => ({
  calculatePaymentsBasedOnParcelsWithActions: vi.fn()
}))

describe('acceptOffer', () => {
  const mockUpdateResult = {
    acknowledged: true,
    modifiedCount: 1,
    upsertedId: null,
    upsertedCount: 0,
    matchedCount: 1,
    agreementNumber: 'sample',
    signatureDate: '2024-01-01T00:00:00.000Z',
    status: 'accepted'
  }
  let mockLogger
  let mockPayments

  beforeAll(() => {
    vi.useFakeTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2024-01-01'))
    mockLogger = { info: vi.fn(), error: vi.fn() }
    mockPayments = {
      agreementStartDate: '2024-01-01',
      agreementEndDate: '2025-01-01',
      frequency: 'Annual',
      agreementTotalPence: 1200,
      annualTotalPence: 1200,
      parcelItems: [],
      agreementLevelItems: [],
      payments: []
    }
    calculatePaymentsBasedOnParcelsWithActions.mockResolvedValue(mockPayments)

    // Mock config values
    config.get = vi.fn((key) => {
      const configValues = {
        'files.s3.bucket': 'test-bucket',
        'files.s3.region': 'eu-west-2',
        'aws.sns.topic.agreementStatusUpdate.arn':
          'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
        'aws.sns.topic.agreementStatusUpdate.type':
          'io.onsite.agreement.status.updated'
      }
      return configValues[key]
    })
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  test('throws Boom.badRequest if agreementNumber is missing', async () => {
    await expect(
      acceptOffer(undefined, {}, 'http://localhost:3555/undefined', mockLogger)
    ).rejects.toThrow('Agreement data is required')

    await expect(
      acceptOffer('', {}, 'http://localhost:3555/', mockLogger)
    ).rejects.toThrow('Agreement data is required')

    await expect(
      acceptOffer(null, {}, 'http://localhost:3555/null', mockLogger)
    ).rejects.toThrow('Agreement data is required')

    await expect(
      acceptOffer(
        'SFI123456789',
        undefined,
        'http://localhost:3555/SFI123456789',
        mockLogger
      )
    ).rejects.toThrow('Agreement data is required')

    await expect(
      acceptOffer(
        'SFI123456789',
        null,
        'http://localhost:3555/SFI123456789',
        mockLogger
      )
    ).rejects.toThrow('Agreement data is required')

    await expect(
      acceptOffer(
        undefined,
        undefined,
        'http://localhost:3555/undefined',
        mockLogger
      )
    ).rejects.toThrow('Agreement data is required')
  })

  test('should throw error when S3 bucket config is missing', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'files.s3.bucket') return null
      if (key === 'files.s3.region') return 'eu-west-2'
      return 'default-value'
    })

    const agreementData = {
      agreementNumber: 'SFI123456789',
      correlationId: 'test-correlation-id',
      clientRef: 'test-client-ref'
    }

    await expect(
      acceptOffer(
        'SFI123456789',
        agreementData,
        'http://localhost:3555/SFI123456789',
        mockLogger
      )
    ).rejects.toThrow(
      'PDF service configuration missing: FILES_S3_BUCKET not set'
    )
  })

  test('should throw error when S3 region config is missing', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'files.s3.bucket') return 'test-bucket'
      if (key === 'files.s3.region') return null
      return 'default-value'
    })

    const agreementData = {
      agreementNumber: 'SFI123456789',
      correlationId: 'test-correlation-id',
      clientRef: 'test-client-ref'
    }

    await expect(
      acceptOffer(
        'SFI123456789',
        agreementData,
        'http://localhost:3555/SFI123456789',
        mockLogger
      )
    ).rejects.toThrow(
      'PDF service configuration missing: FILES_S3_REGION not set'
    )
  })

  test('should successfully accept an agreement', async () => {
    const agreementData = {
      agreementNumber: 'SFI123456789',
      correlationId: 'test-correlation-id',
      clientRef: 'test-client-ref',
      sbi: 'test-sbi',
      frn: 'test-frn',
      version: 1,
      answers: {
        payment: {
          agreementEndDate: '2027-10-31'
        }
      },
      application: { parcel: [{ sheetId: '1', parcelId: '2', actions: [] }] },
      actionApplications: [{ code: 'CMOR1' }]
    }

    // Arrange
    const agreementId = 'SFI123456789'
    agreementsModel.updateOneAgreementVersion.mockResolvedValue(
      mockUpdateResult
    )

    // Act
    const result = await acceptOffer(agreementId, agreementData, mockLogger)

    // Assert
    expect(calculatePaymentsBasedOnParcelsWithActions).toHaveBeenCalledWith(
      agreementData.application.parcel,
      mockLogger
    )
    expect(agreementsModel.updateOneAgreementVersion).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'accepted',
          signatureDate: new Date().toISOString(),
          payment: mockPayments
        }
      }
    )
    expect(result).toEqual(mockUpdateResult)
  })

  test('should not use sample ID in production environment', async () => {
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const agreementId = 'sample'
    agreementsModel.updateOneAgreementVersion.mockResolvedValue(
      mockUpdateResult
    )
    const agreementData = {
      agreementNumber: agreementId,
      application: { parcel: [] },
      actionApplications: []
    }

    // Act
    const result = await acceptOffer(agreementId, agreementData, mockLogger)

    // Assert
    expect(calculatePaymentsBasedOnParcelsWithActions).toHaveBeenCalledWith(
      agreementData.application.parcel,
      mockLogger
    )
    expect(agreementsModel.updateOneAgreementVersion).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'accepted',
          signatureDate: new Date().toISOString(),
          payment: mockPayments
        }
      }
    )
    expect(result).toEqual(mockUpdateResult)

    // Cleanup
    process.env.NODE_ENV = originalNodeEnv
  })

  test('should throw Boom.notFound when agreement is not found', async () => {
    // Arrange
    const agreementId = 'SFI999999999'
    agreementsModel.updateOneAgreementVersion.mockResolvedValue(null)

    // Act & Assert
    await expect(
      acceptOffer(
        agreementId,
        {
          agreementNumber: agreementId,
          application: { parcel: [] },
          actionApplications: []
        },
        'http://localhost:3555/SFI999999999',
        mockLogger
      )
    ).rejects.toThrow(Boom.notFound('Offer not found with ID SFI999999999'))
  })

  test('should handle database errors and log them', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const dbError = Boom.internal('Database connection failed')
    agreementsModel.updateOneAgreementVersion.mockRejectedValue(dbError)

    // Act & Assert
    await expect(
      acceptOffer(
        agreementId,
        {
          agreementNumber: agreementId,
          application: { parcel: [] },
          actionApplications: []
        },
        'http://localhost:3555/SFI123456789',
        mockLogger
      )
    ).rejects.toThrow(Boom.internal('Database connection failed'))
  })

  test('should rethrow Boom errors without wrapping', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const boomError = Boom.badImplementation('Database error')
    agreementsModel.updateOneAgreementVersion.mockRejectedValue(boomError)

    // Act & Assert
    await expect(
      acceptOffer(
        agreementId,
        {
          agreementNumber: agreementId,
          application: { parcel: [] },
          actionApplications: []
        },
        'http://localhost:3555/SFI123456789',
        mockLogger
      )
    ).rejects.toEqual(boomError)
  })
})
