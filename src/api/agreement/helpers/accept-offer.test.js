import { vi } from 'vitest'
import { randomUUID } from 'node:crypto'

import Boom from '@hapi/boom'
import { acceptOffer } from './accept-offer.js'
import { config } from '#~/config/index.js'
import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'
import { updateAgreementWithVersionViaGrant } from '#~/api/agreement/helpers/update-agreement-with-version-via-grant.js'

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn()
}))
vi.mock('#~/api/common/models/agreements.js', () => ({
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
    updateOneAgreementVersion: vi.fn().mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
      upsertedId: null,
      upsertedCount: 0,
      matchedCount: 1,
      agreementNumber: 'sample',
      signatureDate: '2024-01-01T00:00:00.000Z',
      status: 'accepted'
    }),
    createAgreementWithVersions: vi.fn()
  }
}))
vi.mock('#~/api/common/models/versions.js', () => ({
  __esModule: true,
  default: {
    updateOne: vi
      .fn()
      .mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
  }
}))
vi.mock('#~/config/index.js')
vi.mock('#~/api/adapter/land-grants-adapter.js', () => ({
  calculatePaymentsBasedOnParcelsWithActions: vi.fn()
}))
vi.mock(
  '#~/api/agreement/helpers/update-agreement-with-version-via-grant.js',
  () => ({
    updateAgreementWithVersionViaGrant: vi.fn()
  })
)
vi.mock('#~/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('#~/api/common/helpers/audit-event.js', () => ({
  auditEvent: vi.fn(),
  AuditEvent: {
    AGREEMENT_CREATED: 'AGREEMENT_CREATED'
  }
}))
vi.mock('#~/api/common/helpers/send-grant-payment-event.js', () => ({
  sendGrantPaymentEvent: vi.fn().mockImplementation(() => {
    const bucket = config.get('files.s3.bucket')
    const region = config.get('files.s3.region')

    if (!bucket) {
      throw Boom.badRequest(
        'PDF service configuration missing: FILES_S3_BUCKET not set'
      )
    }
    if (!region) {
      throw Boom.badRequest(
        'PDF service configuration missing: FILES_S3_REGION not set'
      )
    }

    return Promise.resolve({ claimId: 'test-claim-id' })
  })
}))
vi.mock('#~/api/agreement/helpers/unaccept-offer.js', () => ({
  unacceptOffer: vi.fn()
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
    vi.mocked(randomUUID).mockReturnValue('generated-correlation-id')
    mockLogger = { info: vi.fn(), error: vi.fn() }
    mockPayments = {
      agreementStartDate: '2024-01-01',
      agreementEndDate: '2025-01-01',
      frequency: 'Annual',
      agreementTotalPence: 1200,
      annualTotalPence: 1200,
      parcelItems: [],
      agreementLevelItems: [],
      payments: [
        {
          totalPaymentPence: 1200,
          paymentDate: '2024-05-01',
          lineItems: []
        }
      ]
    }
    calculatePaymentsBasedOnParcelsWithActions.mockResolvedValue(mockPayments)

    // Mock config values
    config.get = vi.fn((key) => {
      const configValues = {
        'files.s3.bucket': 'test-bucket',
        'files.s3.region': 'eu-west-2',
        'aws.sns.topic.agreementStatusUpdate.arn':
          'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated_fifo.fifo',
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
    // Test with undefined agreementNumber
    await expect(
      acceptOffer(undefined, {}, 'http://localhost:3555/undefined', mockLogger)
    ).rejects.toThrow('Agreement data is required')

    // Test with empty string agreementNumber
    await expect(
      acceptOffer('', {}, 'http://localhost:3555/', mockLogger)
    ).rejects.toThrow('Agreement data is required')

    // Test with null agreementNumber
    await expect(
      acceptOffer(null, {}, 'http://localhost:3555/null', mockLogger)
    ).rejects.toThrow('Agreement data is required')

    // Test with undefined agreementData
    await expect(
      acceptOffer(
        'FPTT123456789',
        undefined,
        'http://localhost:3555/FPTT123456789',
        mockLogger
      )
    ).rejects.toThrow('Agreement data is required')

    // Test with null agreementData
    await expect(
      acceptOffer(
        'FPTT123456789',
        null,
        'http://localhost:3555/FPTT123456789',
        mockLogger
      )
    ).rejects.toThrow('Agreement data is required')

    // Test with both undefined - verify error was thrown (positive assertion)
    let error
    try {
      await acceptOffer(
        undefined,
        undefined,
        'http://localhost:3555/undefined',
        mockLogger
      )
    } catch (e) {
      error = e
    }
    expect(error).toBeDefined()
    expect(error.message).toBe('Agreement data is required')
  })

  test('should throw error when S3 bucket config is missing', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'files.s3.bucket') return null
      if (key === 'files.s3.region') return 'eu-west-2'
      return 'default-value'
    })

    updateAgreementWithVersionViaGrant.mockResolvedValue({
      agreementNumber: 'FPTT123456789',
      status: 'accepted'
    })

    const agreementData = {
      agreementNumber: 'FPTT123456789',
      correlationId: 'test-correlation-id',
      clientRef: 'test-client-ref',
      application: { parcel: [] },
      payment: {
        payments: [],
        parcelItems: {},
        agreementLevelItems: {}
      }
    }

    await expect(
      acceptOffer(
        'FPTT123456789',
        agreementData,
        'http://localhost:3555/FPTT123456789',
        mockLogger
      )
    ).rejects.toThrow(
      'PDF service configuration missing: FILES_S3_BUCKET not set'
    )

    expect(config.get).toHaveBeenCalledWith('files.s3.bucket')
  })

  test('should throw error when S3 region config is missing', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'files.s3.bucket') return 'test-bucket'
      if (key === 'files.s3.region') return null
      return 'default-value'
    })

    updateAgreementWithVersionViaGrant.mockResolvedValue({
      agreementNumber: 'FPTT123456789',
      status: 'accepted'
    })

    const agreementData = {
      agreementNumber: 'FPTT123456789',
      correlationId: 'test-correlation-id',
      clientRef: 'test-client-ref',
      application: { parcel: [] },
      payment: {
        payments: [],
        parcelItems: {},
        agreementLevelItems: {}
      }
    }

    await expect(
      acceptOffer(
        'FPTT123456789',
        agreementData,
        'http://localhost:3555/FPTT123456789',
        mockLogger
      )
    ).rejects.toThrow(
      'PDF service configuration missing: FILES_S3_REGION not set'
    )

    expect(config.get).toHaveBeenCalledWith('files.s3.bucket')
    expect(config.get).toHaveBeenCalledWith('files.s3.region')
  })

  test('should successfully accept an agreement', async () => {
    config.get.mockImplementation((key) => {
      const configValues = {
        'files.s3.bucket': 'test-bucket',
        'files.s3.region': 'eu-west-2'
      }
      return configValues[key]
    })

    const agreementData = {
      agreementNumber: 'FPTT123456789',
      correlationId: 'test-correlation-id',
      clientRef: 'test-client-ref',
      application: { parcel: [] }
    }

    const mockAgreement = {
      agreementNumber: 'FPTT123456789',
      status: 'accepted'
    }

    updateAgreementWithVersionViaGrant.mockResolvedValue(mockAgreement)

    const result = await acceptOffer('FPTT123456789', agreementData, mockLogger)

    expect(result).toEqual(
      expect.objectContaining({
        agreementNumber: 'FPTT123456789',
        status: 'accepted',
        claimId: 'test-claim-id'
      })
    )
    expect(updateAgreementWithVersionViaGrant).toHaveBeenCalledWith(
      { agreementNumber: 'FPTT123456789' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'accepted'
        })
      })
    )
  })

  test('should successfully accept an agreement', async () => {
    const agreementData = {
      agreementNumber: 'FPTT123456789',
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
      actionApplications: [{ code: 'CMOR1' }],
      payment: {
        payments: [],
        parcelItems: {},
        agreementLevelItems: {}
      }
    }

    // Arrange
    const agreementId = 'FPTT123456789'
    updateAgreementWithVersionViaGrant.mockResolvedValue(mockUpdateResult)

    // Act
    const result = await acceptOffer(agreementId, agreementData, mockLogger)

    // Assert
    expect(calculatePaymentsBasedOnParcelsWithActions).toHaveBeenCalledWith(
      agreementData.application.parcel,
      mockLogger
    )
    expect(updateAgreementWithVersionViaGrant).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'accepted',
          signatureDate: new Date().toISOString(),
          payment: {
            ...mockPayments,
            payments: [
              expect.objectContaining({
                totalPaymentPence: 1200,
                paymentDate: '2024-05-01',
                lineItems: [],
                correlationId: expect.any(String)
              })
            ]
          }
        }
      }
    )
    expect(result).toEqual(
      expect.objectContaining({
        agreementNumber: agreementId,
        claimId: 'test-claim-id'
      })
    )
  })

  test('should not use sample ID in production environment', async () => {
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const agreementId = 'sample'
    updateAgreementWithVersionViaGrant.mockResolvedValue(mockUpdateResult)
    const agreementData = {
      agreementNumber: agreementId,
      application: { parcel: [] },
      actionApplications: [],
      payment: {
        payments: [],
        parcelItems: {},
        agreementLevelItems: {}
      }
    }

    // Act
    const result = await acceptOffer(agreementId, agreementData, mockLogger)

    // Assert
    expect(calculatePaymentsBasedOnParcelsWithActions).toHaveBeenCalledWith(
      agreementData.application.parcel,
      mockLogger
    )
    expect(updateAgreementWithVersionViaGrant).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'accepted',
          signatureDate: new Date().toISOString(),
          payment: {
            ...mockPayments,
            payments: [
              expect.objectContaining({
                totalPaymentPence: 1200,
                paymentDate: '2024-05-01',
                lineItems: [],
                correlationId: expect.any(String)
              })
            ]
          }
        }
      }
    )
    expect(result).toEqual(
      expect.objectContaining({
        agreementNumber: agreementId,
        claimId: 'test-claim-id'
      })
    )

    // Cleanup
    process.env.NODE_ENV = originalNodeEnv
  })

  test('should throw Boom.notFound when agreement is not found', async () => {
    // Arrange
    const agreementId = 'FPTT999999999'
    updateAgreementWithVersionViaGrant.mockResolvedValue(null)

    // Act & Assert
    await expect(
      acceptOffer(
        agreementId,
        {
          agreementNumber: agreementId,
          application: { parcel: [] },
          actionApplications: []
        },
        'http://localhost:3555/FPTT999999999',
        mockLogger
      )
    ).rejects.toThrow(Boom.notFound('Offer not found with ID FPTT999999999'))

    expect(updateAgreementWithVersionViaGrant).toHaveBeenCalled()
  })

  test('should handle database errors and log them', async () => {
    // Arrange
    const agreementId = 'FPTT123456789'
    const dbError = Boom.internal('Database connection failed')
    updateAgreementWithVersionViaGrant.mockRejectedValue(dbError)

    // Act & Assert
    await expect(
      acceptOffer(
        agreementId,
        {
          agreementNumber: agreementId,
          application: { parcel: [] },
          actionApplications: []
        },
        'http://localhost:3555/FPTT123456789',
        mockLogger
      )
    ).rejects.toThrow(Boom.internal('Database connection failed'))

    expect(updateAgreementWithVersionViaGrant).toHaveBeenCalled()
  })

  test('should rethrow Boom errors without wrapping', async () => {
    // Arrange
    const agreementId = 'FPTT123456789'
    const boomError = Boom.badImplementation('Database error')
    updateAgreementWithVersionViaGrant.mockRejectedValue(boomError)

    // Act & Assert
    await expect(
      acceptOffer(
        agreementId,
        {
          agreementNumber: agreementId,
          application: { parcel: [] },
          actionApplications: []
        },
        'http://localhost:3555/FPTT123456789',
        mockLogger
      )
    ).rejects.toEqual(boomError)

    expect(updateAgreementWithVersionViaGrant).toHaveBeenCalled()
  })

  test('should preserve an existing payment correlationId', async () => {
    const agreementId = 'FPTT123456789'
    const existingPaymentCorrelationId = 'existing-payment-correlation-id'
    updateAgreementWithVersionViaGrant.mockResolvedValue(mockUpdateResult)
    calculatePaymentsBasedOnParcelsWithActions.mockResolvedValue({
      ...mockPayments,
      payments: [
        {
          ...mockPayments.payments[0],
          correlationId: existingPaymentCorrelationId
        }
      ]
    })

    await acceptOffer(
      agreementId,
      {
        agreementNumber: agreementId,
        application: { parcel: [] },
        actionApplications: [],
        payment: {
          payments: [
            {
              ...mockPayments.payments[0],
              correlationId: existingPaymentCorrelationId
            }
          ],
          parcelItems: {},
          agreementLevelItems: {}
        }
      },
      mockLogger
    )

    expect(randomUUID).not.toHaveBeenCalled()
    expect(updateAgreementWithVersionViaGrant).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: expect.objectContaining({
          payment: expect.objectContaining({
            payments: [
              expect.objectContaining({
                correlationId: existingPaymentCorrelationId
              })
            ]
          })
        })
      }
    )
  })

  test('should wrap non-Boom database errors', async () => {
    const agreementId = 'FPTT123456789'
    updateAgreementWithVersionViaGrant.mockRejectedValue(
      new Error('Database connection failed')
    )

    await expect(
      acceptOffer(
        agreementId,
        {
          agreementNumber: agreementId,
          application: { parcel: [] },
          actionApplications: []
        },
        mockLogger
      )
    ).rejects.toThrow('Database connection failed')

    expect(updateAgreementWithVersionViaGrant).toHaveBeenCalled()
  })
})
