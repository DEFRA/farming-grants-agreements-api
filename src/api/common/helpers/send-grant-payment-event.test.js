import { vi, describe, it, expect, beforeEach } from 'vitest'
import { sendGrantPaymentEvent } from './send-grant-payment-event.js'
import { publishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { createGrantPaymentFromAgreement } from '#~/api/common/helpers/create-grant-payment-from-agreement.js'
import versionsModel from '#~/api/common/models/versions.js'

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'log') {
        return {
          enabled: true,
          redact: [],
          level: 'info',
          format: 'pino-pretty'
        }
      }
      if (key === 'serviceName') return 'test-service'
      if (key === 'serviceVersion') return '1.0.0'
      if (key === 'aws.sns.topic.createPayment.arn') return 'arn:test'
      if (key === 'aws.sns.topic.createPayment.type') return 'test.type'
      return null
    })
  }
}))
vi.mock('#~/api/common/helpers/sns-publisher.js')
vi.mock('#~/api/common/helpers/create-grant-payment-from-agreement.js')
vi.mock('#~/api/common/models/agreements.js')
vi.mock('#~/api/common/models/versions.js')

describe('sendGrantPaymentEvent', () => {
  const mockLogger = { info: vi.fn(), error: vi.fn() }
  const mockAgreementData = {
    _id: 'mock-id',
    agreementNumber: 'FPTT123',
    correlationId: 'existing-id',
    payment: {
      payments: [{ correlationId: 'p1' }, { correlationId: 'p2' }]
    }
  }
  const mockGrantPaymentsData = {
    claimId: 'CLAIM1',
    payments: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createGrantPaymentFromAgreement).mockResolvedValue(
      mockGrantPaymentsData
    )
    vi.mocked(versionsModel.updateOne).mockResolvedValue({ acknowledged: true })
  })

  it('should create payment data, publish event, and update agreement', async () => {
    const result = await sendGrantPaymentEvent(mockAgreementData, mockLogger)

    expect(createGrantPaymentFromAgreement).toHaveBeenCalledWith(
      mockAgreementData,
      mockLogger
    )

    expect(publishEvent).toHaveBeenCalledWith(
      {
        topicArn: 'arn:test',
        type: 'test.type',
        time: expect.any(String),
        data: mockGrantPaymentsData
      },
      mockLogger
    )

    expect(versionsModel.updateOne).toHaveBeenCalledWith(
      { _id: 'mock-id' },
      {
        $set: {
          grantsPaymentServiceRequestMade: true,
          correlationId: mockAgreementData.correlationId,
          'payment.payments': mockAgreementData.payment.payments
        }
      }
    )

    expect(result).toEqual(mockGrantPaymentsData)
  })

  it('should generate and save missing correlationIds along with status', async () => {
    const incompleteData = {
      _id: 'mock-id',
      agreementNumber: 'FPTT123',
      payment: {
        payments: [{ amount: 100 }, { correlationId: 'existing-p2' }]
      }
    }

    await sendGrantPaymentEvent(incompleteData, mockLogger)

    expect(incompleteData.correlationId).toBeDefined()
    expect(incompleteData.payment.payments[0].correlationId).toBeDefined()
    expect(incompleteData.payment.payments[1].correlationId).toBe('existing-p2')

    expect(versionsModel.updateOne).toHaveBeenCalledWith(
      { _id: 'mock-id' },
      {
        $set: {
          grantsPaymentServiceRequestMade: true,
          correlationId: incompleteData.correlationId,
          'payment.payments': incompleteData.payment.payments
        }
      }
    )
  })

  it('should throw if createGrantPaymentFromAgreement fails', async () => {
    const error = new Error('Creation failed')
    vi.mocked(createGrantPaymentFromAgreement).mockRejectedValue(error)

    await expect(
      sendGrantPaymentEvent(mockAgreementData, mockLogger)
    ).rejects.toThrow('Creation failed')

    expect(publishEvent).not.toHaveBeenCalled()
    expect(versionsModel.updateOne).not.toHaveBeenCalled()
  })

  it('should throw if publishEvent fails', async () => {
    const error = new Error('Publish failed')
    vi.mocked(publishEvent).mockRejectedValue(error)

    await expect(
      sendGrantPaymentEvent(mockAgreementData, mockLogger)
    ).rejects.toThrow('Publish failed')

    expect(versionsModel.updateOne).not.toHaveBeenCalled()
  })
})
