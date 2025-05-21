import { jest } from '@jest/globals'
import {
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs'
import {
  handleEvent,
  processMessage,
  deleteMessage,
  pollMessages,
  sqsClientPlugin
} from './sqs-client.js'
import { createAgreement } from '~/src/api/agreement/helpers/create-agreement.js'

jest.mock('~/src/api/agreement/helpers/create-agreement.js')
jest.mock('@aws-sdk/client-sqs')
jest.mock('~/src/config/index.js', () => ({
  config: {
    get: jest.fn((key) => {
      switch (key) {
        case 'sqs.interval':
          return 1000
        case 'sqs.maxMessages':
          return 10
        case 'sqs.waitTime':
          return 5
        case 'sqs.visibilityTimeout':
          return 30
        default:
          return undefined
      }
    })
  }
}))

describe('SQS Client', () => {
  let server
  let mockSqsClient
  let mockLogger
  let setIntervalSpy

  beforeAll(() => {
    // Mock timers
    jest.useFakeTimers()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()

    // Setup logger mock
    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    }

    // Setup SQS client mock
    mockSqsClient = {
      send: jest.fn(),
      destroy: jest.fn()
    }

    // Setup server mock
    server = {
      logger: mockLogger,
      events: {
        on: jest.fn(),
        emit: jest.fn()
      }
    }

    // Spy on setInterval for the tests
    setIntervalSpy = jest.spyOn(global, 'setInterval')
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  it('should initialise properly when registered', () => {
    const options = {
      awsRegion: 'us-east-1',
      sqsEndpoint: 'http://localhost:4566',
      queueUrl: 'test-queue-url'
    }

    // Initialize the plugin
    sqsClientPlugin.plugin.register(server, options)

    // Check that logger was called
    expect(server.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Setting up SQS client')
    )

    // Check that setInterval was called
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000)

    // Check that event handlers were set up
    expect(server.events.on).toHaveBeenCalledWith(
      'closing',
      expect.any(Function)
    )
    expect(server.events.on).toHaveBeenCalledWith('stop', expect.any(Function))
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
        'Invalid message format'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing message'),
        expect.objectContaining({
          message,
          error: expect.any(String)
        })
      )
    })

    it('should handle non-SyntaxError processing errors', async () => {
      const message = {
        Body: JSON.stringify({
          Message: 'invalid event format'
        })
      }

      await expect(processMessage(message, mockLogger)).rejects.toThrow(
        'Invalid message format'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing message'),
        expect.objectContaining({
          message,
          error: expect.any(String)
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
    it('should process multiple messages concurrently', async () => {
      const mockMessages = [
        {
          Body: JSON.stringify({
            Message: JSON.stringify({
              type: 'application.approved',
              data: { id: '123' }
            })
          }),
          ReceiptHandle: 'receipt-1',
          MessageId: 'msg-1'
        },
        {
          Body: JSON.stringify({
            Message: JSON.stringify({
              type: 'application.approved',
              data: { id: '456' }
            })
          }),
          ReceiptHandle: 'receipt-2',
          MessageId: 'msg-2'
        }
      ]

      mockSqsClient.send.mockImplementation((command) => {
        if (command instanceof ReceiveMessageCommand) {
          return Promise.resolve({ Messages: mockMessages })
        }
        return Promise.resolve({})
      })

      await pollMessages(server, mockSqsClient, 'test-queue-url')

      expect(createAgreement).toHaveBeenCalledTimes(2)
      expect(mockSqsClient.send).toHaveBeenCalledTimes(3) // 1 receive + 2 delete
      expect(mockLogger.info).toHaveBeenCalledTimes(4)
    })

    it('should handle empty message response', async () => {
      mockSqsClient.send.mockResolvedValueOnce({ Messages: undefined })

      await pollMessages(server, mockSqsClient, 'test-queue-url')

      expect(createAgreement).not.toHaveBeenCalled()
      expect(mockSqsClient.send).toHaveBeenCalledTimes(1)
    })

    it('should handle message processing errors gracefully', async () => {
      const mockMessage = {
        Body: 'invalid json',
        ReceiptHandle: 'receipt-1',
        MessageId: 'msg-1'
      }

      mockSqsClient.send.mockImplementation((command) => {
        if (command instanceof ReceiveMessageCommand) {
          return Promise.resolve({ Messages: [mockMessage] })
        }
        return Promise.resolve({})
      })

      await pollMessages(server, mockSqsClient, 'test-queue-url')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process message:',
        expect.objectContaining({
          messageId: 'msg-1'
        })
      )
    })

    it('should handle SQS client errors', async () => {
      const error = new Error('SQS error')
      mockSqsClient.send.mockRejectedValueOnce(error)

      await expect(
        pollMessages(server, mockSqsClient, 'test-queue-url')
      ).rejects.toThrow('SQS queue unavailable')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'SQS Polling error:',
        expect.objectContaining({
          error: error.message
        })
      )
    })
  })
})
