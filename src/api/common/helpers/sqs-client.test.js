import { jest } from '@jest/globals'
import {
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs'
import {
  handleEvent,
  processMessage,
  deleteMessage,
  pollMessages
} from './sqs-client.js'
import { createAgreement } from '~/src/api/agreement/helpers/create-agreement.js'

// Mock the AWS SDK modules
jest.mock('@aws-sdk/client-sqs')
jest.mock('~/src/config/index.js')
jest.mock('~/src/api/agreement/helpers/create-agreement.js')

describe('SQS Client', () => {
  let server
  let mockSqsClient
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    }

    mockSqsClient = {
      send: jest.fn(),
      destroy: jest.fn()
    }

    server = {
      logger: mockLogger
    }
  })

  describe('handleEvent', () => {
    it('should create agreement for application-approved events', async () => {
      const mockPayload = {
        type: 'application.approved',
        data: { id: '123', status: 'approved' }
      }

      await handleEvent(mockPayload, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating agreement from event')
      )
      expect(createAgreement).toHaveBeenCalledWith(mockPayload.data)
    })

    it('should ignore non-application-approved events', async () => {
      const mockPayload = {
        type: 'some-other-event',
        data: { id: '123' }
      }

      await handleEvent(mockPayload, mockLogger)

      expect(createAgreement).not.toHaveBeenCalled()
    })
  })

  describe('processMessage', () => {
    it('should process valid SNS message', async () => {
      const mockPayload = {
        type: 'application.approved',
        data: { id: '123' }
      }
      const message = {
        Body: JSON.stringify({
          Message: JSON.stringify(mockPayload)
        })
      }

      await processMessage(message, mockLogger)

      expect(createAgreement).toHaveBeenCalledWith(mockPayload.data)
    })

    it('should handle invalid JSON', async () => {
      const message = {
        Body: 'invalid json'
      }

      await expect(processMessage(message, mockLogger)).rejects.toThrow(
        'Invalid message format',
        expect.objectContaining({
          message: 'invalid json',
          error: 'Unexpected token i in JSON at position 0'
        })
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing message'),
        expect.objectContaining({
          message,
          error: 'Unexpected token \'i\', "invalid json" is not valid JSON'
        })
      )
    })
  })

  describe('deleteMessage', () => {
    it('should delete message from queue', async () => {
      const queueUrl = 'test-queue-url'
      const receiptHandle = 'test-receipt'

      await deleteMessage(mockSqsClient, queueUrl, receiptHandle)

      expect(mockSqsClient.send).toHaveBeenCalledWith(
        expect.any(DeleteMessageCommand)
      )
    })
  })

  describe('pollMessages', () => {
    it('should poll and process messages', async () => {
      const mockPayload = {
        type: 'application.approved',
        data: { id: '123' }
      }
      const mockMessage = {
        Body: JSON.stringify({
          Message: JSON.stringify(mockPayload)
        }),
        ReceiptHandle: 'receipt-123',
        MessageId: 'msg-123'
      }

      mockSqsClient.send.mockImplementation((command) => {
        if (command instanceof ReceiveMessageCommand) {
          return Promise.resolve({ Messages: [mockMessage] })
        }
        return Promise.resolve({})
      })

      await pollMessages(server, mockSqsClient, 'test-queue-url')

      expect(mockSqsClient.send).toHaveBeenCalledWith(
        expect.any(ReceiveMessageCommand)
      )
      expect(createAgreement).toHaveBeenCalledWith(mockPayload.data)
      expect(mockSqsClient.send).toHaveBeenCalledWith(
        expect.any(DeleteMessageCommand)
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('msg-123')
      )
    })

    it('should handle no messages gracefully', async () => {
      mockSqsClient.send.mockResolvedValueOnce({ Messages: undefined })

      await pollMessages(server, mockSqsClient, 'test-queue-url')

      expect(mockSqsClient.send).toHaveBeenCalledWith(
        expect.any(ReceiveMessageCommand)
      )
      expect(createAgreement).not.toHaveBeenCalled()
    })

    it('should handle polling errors', async () => {
      const error = new Error('Polling error')
      mockSqsClient.send.mockRejectedValueOnce(error)

      await expect(
        pollMessages(server, mockSqsClient, 'test-queue-url')
      ).rejects.toThrow('SQS queue unavailable')
    })
  })
})
