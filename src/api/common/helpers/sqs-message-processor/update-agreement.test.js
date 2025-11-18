import { jest } from '@jest/globals'
import { handleUpdateAgreementEvent } from './update-agreement.js'
import { processMessage } from '../sqs-client.js'
import { withdrawOffer } from '~/src/api/agreement/helpers/withdraw-offer.js'
import { publishEvent as mockPublishEvent } from '~/src/api/common/helpers/sns-publisher.js'

jest.mock('~/src/api/agreement/helpers/withdraw-offer.js')
jest.mock('~/src/api/common/helpers/sns-publisher.js')

describe('SQS message processor', () => {
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = { info: jest.fn(), error: jest.fn() }
    withdrawOffer.mockResolvedValue({
      clientRef: 'mockClientRef',
      correlationId: 'mockCorrelationId',
      code: 'mockCode',
      status: 'withdrawn',
      agreement: { agreementNumber: 'SFI123456789' }
    })
  })

  describe('processMessage', () => {
    it('should process APPLICATION_WITHDRAWN SNS message', async () => {
      const mockPayload = {
        type: 'gas-backend.agreement.update',
        data: {
          status: 'APPLICATION_WITHDRAWN',
          clientRef: 'SFI123456789'
        }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(handleUpdateAgreementEvent, message, mockLogger)

      expect(withdrawOffer).toHaveBeenCalledWith('SFI123456789')
      expect(mockPublishEvent).toHaveBeenCalledWith(
        {
          data: {
            agreementNumber: 'SFI123456789',
            clientRef: 'mockClientRef',
            code: 'mockCode',
            correlationId: 'mockCorrelationId',
            date: expect.any(String),
            status: 'withdrawn'
          },
          time: expect.any(String),
          topicArn:
            'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
          type: 'io.onsite.agreement.status.updated'
        },
        mockLogger
      )
    })

    it('should process WITHDRAWAL_REQUESTED SNS message', async () => {
      const mockPayload = {
        type: 'gas-backend.agreement.update',
        data: {
          status: 'PRE_AWARD:APPLICATION:WITHDRAWAL_REQUESTED',
          clientRef: 'SFI123456789'
        }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(handleUpdateAgreementEvent, message, mockLogger)

      expect(withdrawOffer).toHaveBeenCalledWith('SFI123456789')
      expect(mockPublishEvent).toHaveBeenCalledWith(
        {
          data: {
            agreementNumber: 'SFI123456789',
            clientRef: 'mockClientRef',
            code: 'mockCode',
            correlationId: 'mockCorrelationId',
            date: expect.any(String),
            status: 'withdrawn'
          },
          time: expect.any(String),
          topicArn:
            'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
          type: 'io.onsite.agreement.status.updated'
        },
        mockLogger
      )
    })

    it('should handle invalid JSON in message body', async () => {
      const message = {
        Body: 'invalid json'
      }

      await expect(
        processMessage(handleUpdateAgreementEvent, message, mockLogger)
      ).rejects.toThrow('Invalid message format')
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
    it('should withdraw offer for APPLICATION_WITHDRAWN events', async () => {
      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.update',
        data: {
          status: 'APPLICATION_WITHDRAWN',
          clientRef: 'SFI123456789'
        }
      }

      await handleUpdateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Received application withdrawn from event')
      )
      expect(withdrawOffer).toHaveBeenCalledWith('SFI123456789')
      expect(mockPublishEvent).toHaveBeenCalledWith(
        {
          data: {
            agreementNumber: 'SFI123456789',
            clientRef: 'mockClientRef',
            code: 'mockCode',
            correlationId: 'mockCorrelationId',
            date: expect.any(String),
            status: 'withdrawn'
          },
          time: expect.any(String),
          topicArn:
            'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
          type: 'io.onsite.agreement.status.updated'
        },
        mockLogger
      )
    })

    it('should withdraw offer for WITHDRAWAL_REQUESTED events', async () => {
      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.update',
        data: {
          status: 'PRE_AWARD:APPLICATION:WITHDRAWAL_REQUESTED',
          clientRef: 'SFI123456789'
        }
      }

      await handleUpdateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Received application withdrawn from event')
      )
      expect(withdrawOffer).toHaveBeenCalledWith('SFI123456789')
      expect(mockPublishEvent).toHaveBeenCalledWith(
        {
          data: {
            agreementNumber: 'SFI123456789',
            clientRef: 'mockClientRef',
            code: 'mockCode',
            correlationId: 'mockCorrelationId',
            date: expect.any(String),
            status: 'withdrawn'
          },
          time: expect.any(String),
          topicArn:
            'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
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
