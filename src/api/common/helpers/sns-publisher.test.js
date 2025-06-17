import { jest } from '@jest/globals'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { publishMessage, snsPublisherPlugin } from './sns-publisher.js'

// Mock AWS SDK credential provider
jest.mock('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: () => () =>
    Promise.resolve({
      accessKeyId: 'test',
      secretAccessKey: 'test'
    })
}))

// Mock AWS SDK shared INI file loader
jest.mock('@smithy/shared-ini-file-loader', () => ({
  loadSharedConfigFiles: () =>
    Promise.resolve({
      configFile: {},
      credentialsFile: {}
    })
}))

jest.mock('@aws-sdk/client-sns')
jest.mock('~/src/config/index.js', () => ({
  config: {
    get: jest.fn((key) => {
      switch (key) {
        case 'sns.topicArn':
          return 'arn:aws:sns:eu-west-2:000000000000:agreement_accepted'
        case 'aws.region':
          return 'eu-west-2'
        case 'sns.endpoint':
          return 'http://localstack:4566'
        default:
          return undefined
      }
    })
  }
}))

describe('SNS Publisher', () => {
  let server
  let mockSnsClient
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup logger mock
    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    }

    // Setup SNS client mock
    mockSnsClient = {
      send: jest.fn(),
      destroy: jest.fn()
    }
    SNSClient.mockImplementation(() => mockSnsClient)

    // Setup server mock
    server = {
      logger: mockLogger,
      app: {
        snsClient: mockSnsClient
      },
      events: {
        on: jest.fn()
      }
    }
  })

  afterEach(() => {
    jest.resetModules()
  })

  describe('publishMessage', () => {
    it('should successfully publish a message to SNS', async () => {
      const testMessage = {
        type: 'agreement_accepted',
        agreementId: 'SFI123456789',
        timestamp: new Date().toISOString()
      }

      mockSnsClient.send.mockResolvedValueOnce({})

      await publishMessage(testMessage, server)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Preparing to publish message to SNS',
        expect.objectContaining({
          topicArn: expect.any(String),
          message: testMessage
        })
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sending message to SNS',
        expect.objectContaining({
          command: expect.objectContaining({
            TopicArn: expect.any(String),
            Message: expect.any(String)
          })
        })
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Message published successfully to SNS',
        expect.objectContaining({
          topicArn: expect.any(String)
        })
      )

      expect(mockSnsClient.send).toHaveBeenCalledWith(
        expect.any(PublishCommand)
      )
    })

    it('should throw an error if SNS client is not initialized', async () => {
      const testMessage = {
        type: 'agreement_accepted',
        agreementId: 'SFI123456789'
      }

      server.app.snsClient = null

      await expect(publishMessage(testMessage, server)).rejects.toThrow(
        'SNS client not initialized'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error publishing message to SNS:',
        expect.objectContaining({
          message: testMessage,
          error: expect.any(String)
        })
      )
    })

    it('should handle SNS publish errors', async () => {
      const testMessage = {
        type: 'agreement_accepted',
        agreementId: 'SFI123456789'
      }

      const error = new Error('SNS publish failed')
      mockSnsClient.send.mockRejectedValueOnce(error)

      await expect(publishMessage(testMessage, server)).rejects.toThrow(
        'Error publishing SNS message'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error publishing message to SNS:',
        {
          message: testMessage,
          error: 'SNS publish failed',
          stack: expect.any(String),
          topicArn: expect.any(String)
        }
      )
    })
  })

  describe('snsPublisherPlugin', () => {
    const options = {
      awsRegion: 'eu-west-2',
      snsEndpoint: 'http://localstack:4566',
      topicArn: 'arn:aws:sns:eu-west-2:000000000000:agreement_accepted'
    }

    it('should initialize properly when registered', () => {
      snsPublisherPlugin.plugin.register(server, options)

      // Check SNS client was created
      expect(SNSClient).toHaveBeenCalledWith({
        region: options.awsRegion,
        endpoint: options.snsEndpoint
      })

      // Check client was attached to server
      expect(server.app.snsClient).toBe(mockSnsClient)

      // Check stop handler was set up
      expect(server.events.on).toHaveBeenCalledWith(
        'stop',
        expect.any(Function)
      )
    })

    it('should handle plugin cleanup on server stop', async () => {
      snsPublisherPlugin.plugin.register(server, options)

      // Get and call the stop handler
      const stopHandler = server.events.on.mock.calls.find(
        (call) => call[0] === 'stop'
      )[1]
      await stopHandler()

      // Check cleanup was performed
      expect(mockSnsClient.destroy).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Closing SNS client')
      )
    })

    it('should use correct configuration options', () => {
      snsPublisherPlugin.plugin.register(server, options)

      expect(snsPublisherPlugin.options).toEqual({
        awsRegion: 'eu-west-2',
        snsEndpoint: 'http://localstack:4566',
        topicArn: 'arn:aws:sns:eu-west-2:000000000000:agreement_accepted'
      })
    })
  })
})
