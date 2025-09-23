import { jest } from '@jest/globals'
import { handleEvent, processMessage } from './sqs-message-processor.js'
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
        type: 'application.approved',
        data: { id: '123' }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(message, mockLogger)

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

      await expect(processMessage(message, mockLogger)).rejects.toThrow(
        'Invalid message format'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message,
          error: expect.any(String)
        }),
        expect.stringContaining('Error processing message')
      )
    })

    it('should handle non-SyntaxError with Boom.boomify', async () => {
      const message = {
        Body: JSON.stringify({
          Message: JSON.stringify({ type: 'invalid.type' })
        })
      }

      await expect(processMessage(message, mockLogger)).rejects.toThrow(
        'Error processing SQS message'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message,
          error: expect.any(String)
        }),
        expect.stringContaining('Error processing message')
      )
    })
  })

  describe('handleEvent', () => {
    it('should create agreement for application-approved events', async () => {
      const mockPayload = {
        type: 'application.approved',
        data: { id: '123', status: 'approved' }
      }

      await handleEvent('aws-message-id', mockPayload, mockLogger)

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
        handleEvent('aws-message-id', mockPayload, mockLogger)
      ).rejects.toThrow('Unrecognized event type')

      expect(createOffer).not.toHaveBeenCalled()
    })
  })
})
