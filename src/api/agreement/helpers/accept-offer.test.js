import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { acceptOffer, getFirstPaymentDate } from './accept-offer.js'
import * as snsPublisher from '~/src/api/common/helpers/sns-publisher.js'
import { config } from '~/src/config/index.js'

jest.mock('~/src/api/common/models/agreements.js')
jest.mock('~/src/api/common/helpers/sns-publisher.js')
jest.mock('~/src/config/index.js')

describe('acceptOffer', () => {
  const mockUpdateResult = {
    acknowledged: true,
    modifiedCount: 1,
    upsertedId: null,
    upsertedCount: 0,
    matchedCount: 1
  }
  let mockLogger

  beforeAll(() => {
    jest.useFakeTimers()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.setSystemTime(new Date('2024-01-01'))
    mockLogger = { info: jest.fn(), error: jest.fn() }

    // Mock config values
    config.get = jest.fn((key) => {
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
    jest.useRealTimers()
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

    expect(mockLogger.error).toHaveBeenCalledWith(
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

    expect(mockLogger.error).toHaveBeenCalledWith(
      'PDF service configuration missing: FILES_S3_REGION not set'
    )
  })

  test('should successfully accept an agreement', async () => {
    const agreementData = {
      agreementNumber: 'SFI123456789',
      correlationId: 'test-correlation-id',
      clientRef: 'test-client-ref',
      frn: 'test-frn',
      sbi: 'test-sbi',
      version: 1
    }

    // Arrange
    const agreementId = 'SFI123456789'
    agreementsModel.updateOneAgreementVersion.mockResolvedValue(
      mockUpdateResult
    )
    const mockEventResult = Promise.resolve()
    snsPublisher.publishEvent.mockReturnValue(mockEventResult)
    // Act
    const result = await acceptOffer(
      agreementId,
      agreementData,
      'http://localhost:3555/SFI123456789',
      mockLogger
    )

    // Assert
    expect(snsPublisher.publishEvent).toHaveBeenCalledWith(
      {
        time: '2024-01-01T00:00:00.000Z',
        topicArn: 'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
        type: 'io.onsite.agreement.status.updated',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          version: 1,
          agreementUrl: 'http://localhost:3555/SFI123456789',
          clientRef: 'test-client-ref',
          status: 'accepted',
          date: '2024-01-01T00:00:00.000Z'
        }
      },
      mockLogger
    )
    expect(agreementsModel.updateOneAgreementVersion).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'accepted',
          signatureDate: new Date().toISOString()
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

    // Act
    const result = await acceptOffer(
      agreementId,
      { agreementNumber: agreementId },
      'http://localhost:3555/sample',
      mockLogger
    )

    // Assert
    expect(agreementsModel.updateOneAgreementVersion).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'accepted',
          signatureDate: new Date().toISOString()
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
        { agreementNumber: agreementId },
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
        { agreementNumber: agreementId },
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
        { agreementNumber: agreementId },
        'http://localhost:3555/SFI123456789',
        mockLogger
      )
    ).rejects.toEqual(boomError)
  })
})

describe('getFirstPaymentDate', () => {
  test('returns correct first payment date', () => {
    expect(getFirstPaymentDate('2024-02-15')).toBe('May 2024')
    expect(getFirstPaymentDate('2024-02-31')).toBe('June 2024')
    expect(getFirstPaymentDate('2024-12-26')).toBe('March 2025')
    expect(getFirstPaymentDate('2024-12-27')).toBe('April 2025')
  })

  test('handles invalid date string gracefully', () => {
    expect(getFirstPaymentDate('invalid-date')).toBe('')
  })
})
