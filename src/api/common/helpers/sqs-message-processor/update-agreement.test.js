import { vi } from 'vitest'
import { handleUpdateAgreementEvent } from './update-agreement.js'
import { AGREEMENT_STATUS } from '#~/api/common/constants/agreement-status.js'
import { processMessage } from '../sqs-client.js'
import { withdrawOffer } from '#~/api/agreement/helpers/withdraw-offer.js'
import { publishEvent as mockPublishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { config } from '#~/config/index.js'

vi.mock('#~/api/agreement/helpers/withdraw-offer.js')
vi.mock('#~/api/common/helpers/sns-publisher.js')

describe('AGREEMENT_STATUS', () => {
  it('should define all expected status values', () => {
    expect(AGREEMENT_STATUS).toMatchObject({
      WITHDRAWN: 'withdrawn',
      ACCEPTED: 'accepted',
      TERMINATED: 'terminated',
      CANCELLED: 'cancelled',
      OFFERED: 'offered'
    })
  })

  it('should be frozen', () => {
    expect(Object.isFrozen(AGREEMENT_STATUS)).toBe(true)
  })
})

describe('SQS message processor', () => {
  const mockUpdatedAt = '2025-01-01T00:00:00.000Z'
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger = { info: vi.fn(), error: vi.fn() }
    withdrawOffer.mockResolvedValue({
      clientRef: 'mockClientRef',
      correlationId: 'mockCorrelationId',
      code: 'mockCode',
      status: 'withdrawn',
      updatedAt: mockUpdatedAt,
      agreement: { agreementNumber: 'FPTT123456789' }
    })
  })

  describe('processMessage', () => {
    it('should process withdrawn SNS message', async () => {
      const mockPayload = {
        type: 'gas-backend.agreement.update',
        data: {
          status: 'withdrawn',
          clientRef: 'client-ref-001',
          agreementNumber: 'FPTT123456789'
        }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(handleUpdateAgreementEvent, message, mockLogger)

      expect(withdrawOffer).toHaveBeenCalledWith(
        'client-ref-001',
        'FPTT123456789'
      )
      expect(mockPublishEvent).toHaveBeenCalledWith(
        {
          data: {
            agreementNumber: 'FPTT123456789',
            clientRef: 'mockClientRef',
            code: 'mockCode',
            correlationId: 'mockCorrelationId',
            date: mockUpdatedAt,
            status: 'withdrawn'
          },
          time: expect.any(String),
          topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
          type: 'io.onsite.agreement.status.updated'
        },
        mockLogger
      )
    })

    it('should handle invalid JSON in message body', async () => {
      const message = {
        Body: 'invalid json'
      }

      let caughtError
      try {
        await processMessage(handleUpdateAgreementEvent, message, mockLogger)
      } catch (error) {
        caughtError = error
      }

      expect(caughtError).toBeDefined()
      expect(caughtError.message).toContain('Invalid message format')
      expect(caughtError.message).toContain('invalid json')
    })

    it('should handle non-SyntaxError with Boom.boomify', async () => {
      const message = {
        Body: JSON.stringify({
          type: 'invalid.type',
          data: { status: 'invalid.status' }
        })
      }

      await processMessage(handleUpdateAgreementEvent, message, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No action required for GAS application status update event: invalid.type (invalid.status)'
      )
      expect(mockPublishEvent).not.toHaveBeenCalled()
    })
  })

  describe('handleEvent', () => {
    it('should withdraw offer for withdrawn events', async () => {
      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.update',
        data: {
          status: 'withdrawn',
          clientRef: 'client-ref-001',
          agreementNumber: 'FPTT123456789'
        }
      }

      await handleUpdateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Received application status update (withdrawn) from event'
        )
      )
      expect(withdrawOffer).toHaveBeenCalledWith(
        'client-ref-001',
        'FPTT123456789'
      )
      expect(mockPublishEvent).toHaveBeenCalledWith(
        {
          data: {
            agreementNumber: 'FPTT123456789',
            clientRef: 'mockClientRef',
            code: 'mockCode',
            correlationId: 'mockCorrelationId',
            date: mockUpdatedAt,
            status: 'withdrawn'
          },
          time: expect.any(String),
          topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
          type: 'io.onsite.agreement.status.updated'
        },
        mockLogger
      )
    })

    it('should log an info for non-application-withdrawn events', async () => {
      const mockPayload = {
        type: 'some-other-event',
        data: { id: '123' }
      }

      await handleUpdateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(withdrawOffer).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No action required for GAS application status update event: some-other-event'
      )
      expect(mockPublishEvent).not.toHaveBeenCalled()
    })

    it('should log an info for non-application-withdrawn events with no type', async () => {
      const mockPayload = {
        noType: 'missing.type',
        data: { id: '123' }
      }

      await handleUpdateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(withdrawOffer).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No action required for GAS application status update event: {"noType":"missing.type","data":{"id":"123"}}'
      )
    })

    it('should log empty messages', async () => {
      await handleUpdateAgreementEvent('aws-message-id', undefined, mockLogger)

      expect(withdrawOffer).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No action required for GAS application status update event: undefined'
      )
    })

    it('should handle empty data', async () => {
      const mockPayload = {
        type: 'empty data'
      }

      await handleUpdateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(withdrawOffer).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No action required for GAS application status update event: empty data'
      )
    })
  })
})
