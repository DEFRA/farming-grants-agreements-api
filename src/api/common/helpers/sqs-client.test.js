import { jest } from '@jest/globals'
import { SQSClient } from '@aws-sdk/client-sqs'
import { Consumer } from 'sqs-consumer'
import { createSqsClientPlugin } from './sqs-client.js'
import { handleCreateAgreementEvent } from './sqs-message-processor/create-agreement.js'
import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'

// Mock AWS SDK credential provider
jest.mock('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: () => () =>
    Promise.resolve({
      accessKeyId: 'test',
      secretAccessKey: 'test'
    })
}))

jest.mock('~/src/api/agreement/helpers/create-offer.js')
jest.mock('@aws-sdk/client-sqs')
jest.mock('~/src/config/index.js', () => ({
  config: {
    get: jest.fn((key) => {
      switch (key) {
        case 'sqs.maxMessages':
          return 10
        case 'sqs.waitTime':
          return 5
        case 'sqs.visibilityTimeout':
          return 30
        case 'featureFlags.seedDb':
          return true
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
  let mockConsumer

  beforeEach(() => {
    jest.clearAllMocks()

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
    SQSClient.mockImplementation(() => mockSqsClient)

    // Setup server mock
    server = {
      logger: mockLogger,
      events: {
        on: jest.fn(),
        emit: jest.fn()
      }
    }

    // Setup Consumer mock
    mockConsumer = {
      start: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    }
    Consumer.create.mockReturnValue(mockConsumer)

    // Setup createOffer mock to return a mock agreement
    createOffer.mockResolvedValue({
      agreementNumber: 'SFI123456789',
      notificationMessageId: 'test-message-id',
      frn: '123456789',
      sbi: '123456789'
    })
  })

  afterEach(() => {
    jest.resetModules()
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

      await handleCreateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(createOffer).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No action required for GAS create offer event: some-other-event'
      )
    })
  })

  describe('sqsClientPlugin', () => {
    const options = {
      awsRegion: 'us-east-1',
      sqsEndpoint: 'http://localhost:4566',
      queueUrl: 'test-queue-url'
    }

    it('should initialize properly when registered', () => {
      const sqsClientPlugin = createSqsClientPlugin(
        'test',
        options.queueUrl,
        jest.fn()
      )
      sqsClientPlugin.plugin.register(server, options)

      // Check SQS client was created
      expect(SQSClient).toHaveBeenCalledWith({
        region: options.awsRegion,
        endpoint: options.sqsEndpoint
      })

      // Check Consumer was created with correct options
      expect(Consumer.create).toHaveBeenCalledWith({
        queueUrl: options.queueUrl,
        handleMessage: expect.any(Function),
        sqs: mockSqsClient,
        batchSize: 10,
        waitTimeSeconds: 5,
        visibilityTimeout: 30,
        handleMessageTimeout: 30000,
        attributeNames: ['All'],
        messageAttributeNames: ['All']
      })

      // Check error handlers were set up
      expect(mockConsumer.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      )
      expect(mockConsumer.on).toHaveBeenCalledWith(
        'processing_error',
        expect.any(Function)
      )

      // Check consumer was started
      expect(mockConsumer.start).toHaveBeenCalled()

      // Check stop handler was set up
      expect(server.events.on).toHaveBeenCalledWith(
        'stop',
        expect.any(Function)
      )
    })

    it('should handle plugin cleanup on server stop', async () => {
      const sqsClientPlugin = createSqsClientPlugin(
        'test',
        options.queueUrl,
        jest.fn()
      )
      sqsClientPlugin.plugin.register(server, options)

      // Get and call the stop handler
      const stopHandler = server.events.on.mock.calls.find(
        (call) => call[0] === 'stop'
      )[1]
      await stopHandler()

      // Check cleanup was performed
      expect(mockConsumer.stop).toHaveBeenCalled()
      expect(mockSqsClient.destroy).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Stopping SQS consumer')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Closing SQS client')
      )
    })

    it('should handle message processing errors', async () => {
      const sqsClientPlugin = createSqsClientPlugin(
        'test',
        options.queueUrl,
        jest.fn()
      )
      sqsClientPlugin.plugin.register(server, options)

      // Get the message handler
      const messageHandler = Consumer.create.mock.calls[0][0].handleMessage

      // Call handler with invalid message
      const invalidMessage = {
        Body: 'invalid json',
        MessageId: 'msg-1'
      }

      await messageHandler(invalidMessage)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to process SQS (test) message: Invalid message format: {"Body":"invalid json","MessageId":"msg-1"}'
      )
    })

    it('should handle consumer errors', () => {
      const sqsClientPlugin = createSqsClientPlugin(
        'test',
        options.queueUrl,
        jest.fn()
      )
      sqsClientPlugin.plugin.register(server, options)

      // Get the error handler
      const errorHandler = mockConsumer.on.mock.calls.find(
        (call) => call[0] === 'error'
      )[1]

      // Call error handler
      const error = new Error('Consumer error')
      errorHandler(error)

      expect(mockLogger.error).toHaveBeenCalledWith(
        error,
        'SQS Consumer (test) error: Consumer error'
      )
    })

    it('should handle processing errors', () => {
      const sqsClientPlugin = createSqsClientPlugin(
        'test',
        options.queueUrl,
        jest.fn()
      )
      sqsClientPlugin.plugin.register(server, options)

      // Get the processing error handler
      const errorHandler = mockConsumer.on.mock.calls.find(
        (call) => call[0] === 'processing_error'
      )[1]

      // Call error handler
      const error = new Error('Processing error')
      errorHandler(error)

      expect(mockLogger.error).toHaveBeenCalledWith(
        error,
        'SQS Message (test) processing error: Processing error'
      )
    })

    it('should start the consumer successfully', () => {
      const sqsClientPlugin = createSqsClientPlugin(
        'test',
        options.queueUrl,
        jest.fn()
      )
      sqsClientPlugin.plugin.register(server, options)

      mockConsumer.on.mock.calls.find((call) => call[0] === 'started')[1]()

      expect(mockLogger.info).toHaveBeenCalledWith(
        'SQS Consumer (test) started'
      )
    })
  })
})
