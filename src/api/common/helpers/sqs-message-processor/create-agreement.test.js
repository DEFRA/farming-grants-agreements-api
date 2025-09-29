import { jest } from '@jest/globals'
import { handleCreateAgreementEvent } from './create-agreement.js'
import { processMessage } from '../sqs-client.js'
import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'

jest.mock('~/src/api/agreement/helpers/create-offer.js')

describe('SQS message processor', () => {
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = { info: jest.fn(), error: jest.fn() }
    createOffer.mockResolvedValue({
      agreementNumber: 'SFI123456789'
    })
  })

  describe('processMessage', () => {
    it('should process valid SNS message', async () => {
      const mockPayload = {
        type: 'gas-backend.agreement.create',
        data: { id: '123' }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(handleCreateAgreementEvent, message, mockLogger)

      expect(createOffer).toHaveBeenCalledWith(
        'aws-message-id',
        mockPayload.data,
        mockLogger
      )
    })

    it('should handle invalid JSON in message body', async () => {
      const message = {
        Body: 'invalid json'
      }

      await expect(
        processMessage(handleCreateAgreementEvent, message, mockLogger)
      ).rejects.toThrow('Invalid message format')
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('Error processing message')
      )
    })

    it('should handle non-SyntaxError with Boom.boomify', async () => {
      const message = {
        Body: JSON.stringify({
          Message: JSON.stringify({ type: 'invalid.type' })
        })
      }

      await expect(
        processMessage(handleCreateAgreementEvent, message, mockLogger)
      ).rejects.toThrow('Error processing SQS message')
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('Error processing message')
      )
    })
  })

  describe('handleEvent', () => {
    it('should create agreement for application-approved events', async () => {
      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.create',
        data: { id: '123', status: 'approved' }
      }

      await handleCreateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating agreement from event')
      )
      expect(createOffer).toHaveBeenCalledWith(
        'aws-message-id',
        mockPayload.data,
        mockLogger
      )
    })

    it('should throw an error for non-application-approved events', async () => {
      const mockPayload = {
        type: 'some-other-event',
        data: { id: '123' }
      }

      await expect(
        handleCreateAgreementEvent('aws-message-id', mockPayload, mockLogger)
      ).rejects.toThrow('Unrecognized event type')

      expect(createOffer).not.toHaveBeenCalled()
    })
  })
})
