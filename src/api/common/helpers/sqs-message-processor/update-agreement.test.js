import { jest } from '@jest/globals'
import { handleUpdateAgreementEvent } from './update-agreement.js'
import { processMessage } from '../sqs-client.js'
import { withdrawOffer } from '~/src/api/agreement/helpers/withdraw-offer.js'

jest.mock('~/src/api/agreement/helpers/withdraw-offer.js')

describe('SQS message processor', () => {
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = { info: jest.fn(), error: jest.fn() }
    withdrawOffer.mockResolvedValue({
      agreement: { agreementNumber: 'SFI123456789' }
    })
  })

  describe('processMessage', () => {
    it('should process valid SNS message', async () => {
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

      await expect(
        processMessage(handleUpdateAgreementEvent, message, mockLogger)
      ).rejects.toThrow(
        'Unrecognized event type: invalid.type (invalid.status)'
      )
    })
  })

  describe('handleEvent', () => {
    it('should withdraw offer for application-withdrawn events', async () => {
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
    })

    it('should throw an error for non-application-withdrawn events', async () => {
      const mockPayload = {
        type: 'some-other-event',
        data: { id: '123' }
      }

      await expect(
        handleUpdateAgreementEvent('aws-message-id', mockPayload, mockLogger)
      ).rejects.toThrow('Unrecognized event type')

      expect(withdrawOffer).not.toHaveBeenCalled()
    })
  })
})
