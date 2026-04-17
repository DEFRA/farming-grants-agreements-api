import { vi, describe, it, expect, beforeEach } from 'vitest'
import { sendGrantPaymentEvent } from './send-grant-payment-event.js'
import { publishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { createGrantPaymentFromAgreement } from '#~/api/common/helpers/create-grant-payment-from-agreement.js'
import agreementsModel from '#~/api/common/models/agreements.js'

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

describe('sendGrantPaymentEvent', () => {
  const mockLogger = { info: vi.fn(), error: vi.fn() }
  const mockAgreementData = {
    agreementNumber: 'FPTT123',
    some: 'data'
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

    expect(agreementsModel.updateOneAgreementVersion).toHaveBeenCalledWith(
      { agreementNumber: 'FPTT123' },
      { $set: { grantsPaymentServiceRequestMade: true } }
    )

    expect(result).toEqual(mockGrantPaymentsData)
  })

  it('should throw if createGrantPaymentFromAgreement fails', async () => {
    const error = new Error('Creation failed')
    vi.mocked(createGrantPaymentFromAgreement).mockRejectedValue(error)

    await expect(
      sendGrantPaymentEvent(mockAgreementData, mockLogger)
    ).rejects.toThrow('Creation failed')

    expect(publishEvent).not.toHaveBeenCalled()
    expect(agreementsModel.updateOneAgreementVersion).not.toHaveBeenCalled()
  })

  it('should throw if publishEvent fails', async () => {
    const error = new Error('Publish failed')
    vi.mocked(publishEvent).mockRejectedValue(error)

    await expect(
      sendGrantPaymentEvent(mockAgreementData, mockLogger)
    ).rejects.toThrow('Publish failed')

    expect(agreementsModel.updateOneAgreementVersion).not.toHaveBeenCalled()
  })
})
