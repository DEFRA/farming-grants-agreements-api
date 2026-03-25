import { handleUpdateAgreementEvent } from './update-agreement.js'
import { AGREEMENT_STATUS } from '#~/api/common/constants/agreement-status.js'
import { createSqsClientPlugin } from '../sqs-client.js'
import { withdrawOffer } from '#~/api/agreement/helpers/withdraw-offer.js'
import { cancelOffer } from '#~/api/agreement/helpers/cancel-offer.js'
import { terminateAgreement } from '#~/api/agreement/helpers/terminate-agreement.js'
import { publishEvent as mockPublishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { auditEvent as mockAuditEvent } from '#~/api/common/helpers/audit-event.js'
import { config } from '#~/config/index.js'
import { Consumer } from 'sqs-consumer'

vi.mock('#~/api/agreement/helpers/withdraw-offer.js')
vi.mock('#~/api/agreement/helpers/cancel-offer.js')
vi.mock('#~/api/agreement/helpers/terminate-agreement.js')
vi.mock('#~/api/common/helpers/sns-publisher.js')
vi.mock('#~/api/common/helpers/audit-event.js')
vi.mock('sqs-consumer', () => ({
  Consumer: {
    create: vi.fn().mockImplementation((options) => ({
      options,
      on: vi.fn(),
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue()
    }))
  }
}))

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
    mockAuditEvent.mockReturnValue(undefined)
    withdrawOffer.mockResolvedValue({
      clientRef: 'mockClientRef',
      correlationId: 'mockCorrelationId',
      code: 'mockCode',
      status: 'withdrawn',
      updatedAt: mockUpdatedAt,
      agreement: { agreementNumber: 'FPTT123456789' }
    })
    cancelOffer.mockResolvedValue({
      clientRef: 'mockClientRef',
      correlationId: 'mockCorrelationId',
      code: 'mockCode',
      status: 'cancelled',
      updatedAt: mockUpdatedAt,
      agreement: { agreementNumber: 'FPTT123456789' }
    })
    terminateAgreement.mockResolvedValue({
      clientRef: 'mockClientRef',
      correlationId: 'mockCorrelationId',
      code: 'mockCode',
      status: 'terminated',
      updatedAt: mockUpdatedAt,
      agreement: { agreementNumber: 'FPTT123456789' }
    })
  })

  describe('processMessage', () => {
    const getHandleMessage = (callback) => {
      const { plugin, options } = createSqsClientPlugin(
        'test-tag',
        'http://test-queue',
        callback
      )
      const mockServer = { logger: mockLogger, events: { on: vi.fn() } }
      plugin.register(mockServer, options)

      // Get the handleMessage callback from the Consumer.create call
      return Consumer.create.mock.calls[0][0].handleMessage
    }

    it('should process withdrawn SNS message', async () => {
      const handleMessage = getHandleMessage(handleUpdateAgreementEvent)

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

      await handleMessage(message)

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
      expect(mockAuditEvent).toHaveBeenCalledWith('AGREEMENT_UPDATED', {
        clientRef: 'mockClientRef',
        correlationId: 'mockCorrelationId',
        code: 'mockCode',
        status: 'withdrawn',
        updatedAt: mockUpdatedAt,
        agreement: { agreementNumber: 'FPTT123456789' },
        agreementNumber: 'FPTT123456789'
      })
    })

    it('should process cancelled SNS message', async () => {
      const handleMessage = getHandleMessage(handleUpdateAgreementEvent)

      const mockPayload = {
        type: 'gas-backend.agreement.update',
        data: {
          status: 'cancelled',
          clientRef: 'client-ref-001',
          agreementNumber: 'FPTT123456789'
        }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await handleMessage(message)

      expect(cancelOffer).toHaveBeenCalledWith(
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
            status: 'cancelled'
          },
          time: expect.any(String),
          topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
          type: 'io.onsite.agreement.status.updated'
        },
        mockLogger
      )
      expect(mockAuditEvent).toHaveBeenCalledWith('AGREEMENT_UPDATED', {
        clientRef: 'mockClientRef',
        correlationId: 'mockCorrelationId',
        code: 'mockCode',
        status: 'cancelled',
        updatedAt: mockUpdatedAt,
        agreement: { agreementNumber: 'FPTT123456789' },
        agreementNumber: 'FPTT123456789'
      })
    })

    it('should process terminated SNS message', async () => {
      const handleMessage = getHandleMessage(handleUpdateAgreementEvent)

      const mockPayload = {
        type: 'gas-backend.agreement.update',
        data: {
          status: 'terminated',
          clientRef: 'client-ref-001',
          agreementNumber: 'FPTT123456789'
        }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await handleMessage(message)

      expect(terminateAgreement).toHaveBeenCalledWith(
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
            status: 'terminated'
          },
          time: expect.any(String),
          topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
          type: 'io.onsite.agreement.status.updated'
        },
        mockLogger
      )
      expect(mockAuditEvent).toHaveBeenCalledWith('AGREEMENT_UPDATED', {
        clientRef: 'mockClientRef',
        correlationId: 'mockCorrelationId',
        code: 'mockCode',
        status: 'terminated',
        updatedAt: mockUpdatedAt,
        agreement: { agreementNumber: 'FPTT123456789' },
        agreementNumber: 'FPTT123456789'
      })
    })

    it('should handle invalid JSON in message body', async () => {
      const handleMessage = getHandleMessage(handleUpdateAgreementEvent)

      const message = {
        Body: 'invalid json'
      }

      await handleMessage(message)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining(
          'Failed to process SQS (test-tag) message: Invalid message format'
        )
      )
    })

    it('should handle non-SyntaxError with Boom.boomify', async () => {
      const handleMessage = getHandleMessage(handleUpdateAgreementEvent)

      const message = {
        Body: JSON.stringify({
          type: 'invalid.type',
          data: { status: 'invalid.status' }
        })
      }

      await handleMessage(message)

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
      expect(mockAuditEvent).toHaveBeenCalledWith('AGREEMENT_UPDATED', {
        clientRef: 'mockClientRef',
        correlationId: 'mockCorrelationId',
        code: 'mockCode',
        status: 'withdrawn',
        updatedAt: mockUpdatedAt,
        agreement: { agreementNumber: 'FPTT123456789' },
        agreementNumber: 'FPTT123456789'
      })
    })

    it('should cancel offer for cancelled events', async () => {
      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.update',
        data: {
          status: 'cancelled',
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
          'Received application status update (cancelled) from event'
        )
      )
      expect(cancelOffer).toHaveBeenCalledWith(
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
            status: 'cancelled'
          },
          time: expect.any(String),
          topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
          type: 'io.onsite.agreement.status.updated'
        },
        mockLogger
      )
      expect(mockAuditEvent).toHaveBeenCalledWith('AGREEMENT_UPDATED', {
        clientRef: 'mockClientRef',
        correlationId: 'mockCorrelationId',
        code: 'mockCode',
        status: 'cancelled',
        updatedAt: mockUpdatedAt,
        agreement: { agreementNumber: 'FPTT123456789' },
        agreementNumber: 'FPTT123456789'
      })
    })

    it('should terminate agreement for terminated events', async () => {
      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.update',
        data: {
          status: 'terminated',
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
          'Received application status update (terminated) from event'
        )
      )
      expect(terminateAgreement).toHaveBeenCalledWith(
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
            status: 'terminated'
          },
          time: expect.any(String),
          topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
          type: 'io.onsite.agreement.status.updated'
        },
        mockLogger
      )
      expect(mockAuditEvent).toHaveBeenCalledWith('AGREEMENT_UPDATED', {
        clientRef: 'mockClientRef',
        correlationId: 'mockCorrelationId',
        code: 'mockCode',
        status: 'terminated',
        updatedAt: mockUpdatedAt,
        agreement: { agreementNumber: 'FPTT123456789' },
        agreementNumber: 'FPTT123456789'
      })
    })

    it('should take no action for a known status with no handler', async () => {
      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.update',
        data: {
          status: 'offered',
          clientRef: 'client-ref-001',
          agreementNumber: 'FPTT123456789'
        }
      }

      await handleUpdateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(withdrawOffer).not.toHaveBeenCalled()
      expect(cancelOffer).not.toHaveBeenCalled()
      expect(terminateAgreement).not.toHaveBeenCalled()
      expect(mockAuditEvent).not.toHaveBeenCalled()
      expect(mockPublishEvent).not.toHaveBeenCalled()
    })

    it('should fire a failure audit event and re-throw when withdrawOffer fails', async () => {
      const error = new Error('DB connection failed')
      withdrawOffer.mockRejectedValue(error)

      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.update',
        data: {
          status: 'withdrawn',
          clientRef: 'client-ref-001',
          agreementNumber: 'FPTT123456789'
        }
      }

      await expect(
        handleUpdateAgreementEvent('aws-message-id', mockPayload, mockLogger)
      ).rejects.toThrow(error)

      expect(mockAuditEvent).toHaveBeenCalledWith(
        'AGREEMENT_UPDATED',
        {
          agreementNumber: 'FPTT123456789',
          clientRef: 'client-ref-001',
          status: 'withdrawn',
          message: 'DB connection failed'
        },
        'failure'
      )
    })

    it('should fire a failure audit event and re-throw when cancelOffer fails', async () => {
      const error = new Error('DB connection failed')
      cancelOffer.mockRejectedValue(error)

      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.update',
        data: {
          status: 'cancelled',
          clientRef: 'client-ref-001',
          agreementNumber: 'FPTT123456789'
        }
      }

      await expect(
        handleUpdateAgreementEvent('aws-message-id', mockPayload, mockLogger)
      ).rejects.toThrow(error)

      expect(mockAuditEvent).toHaveBeenCalledWith(
        'AGREEMENT_UPDATED',
        {
          agreementNumber: 'FPTT123456789',
          clientRef: 'client-ref-001',
          status: 'cancelled',
          message: 'DB connection failed'
        },
        'failure'
      )
    })

    it('should fire a failure audit event and re-throw when terminateAgreement fails', async () => {
      const error = new Error('DB connection failed')
      terminateAgreement.mockRejectedValue(error)

      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.update',
        data: {
          status: 'terminated',
          clientRef: 'client-ref-001',
          agreementNumber: 'FPTT123456789'
        }
      }

      await expect(
        handleUpdateAgreementEvent('aws-message-id', mockPayload, mockLogger)
      ).rejects.toThrow(error)

      expect(mockAuditEvent).toHaveBeenCalledWith(
        'AGREEMENT_UPDATED',
        {
          agreementNumber: 'FPTT123456789',
          clientRef: 'client-ref-001',
          status: 'terminated',
          message: 'DB connection failed'
        },
        'failure'
      )
    })

    it('should not fire an audit event when no update occurred', async () => {
      const mockPayload = {
        type: 'some-other-event',
        data: { id: '123' }
      }

      await handleUpdateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(mockAuditEvent).not.toHaveBeenCalled()
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
