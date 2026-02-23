import { publishEvent } from './sns-publisher.js'
import { PublishCommand } from '@aws-sdk/client-sns'
import { v4 as uuidv4 } from 'uuid'
import { config } from '#~/config/index.js'

vi.mock('@aws-sdk/client-sns')
vi.mock('uuid')
vi.mock('#~/config/index.js', () => ({
  config: { get: vi.fn() }
}))

// Mock setTimeout to use shorter delays for faster tests
const originalSetTimeout = global.setTimeout

beforeAll(() => {
  global.setTimeout = (fn, delay) => originalSetTimeout(fn, Math.min(delay, 10))
})

afterAll(() => {
  global.setTimeout = originalSetTimeout
})

describe('publishEvent', () => {
  const mockSend = vi.fn()
  const logger = { info: vi.fn(), error: vi.fn() }

  const mockClient = { send: mockSend }

  const mockMessageTopicArn = 'arn:aws:sns:eu-west-2:123456789012:test-topic'
  const mockMessageType = 'TestType'
  const mockMessageTime = '2025-08-12T14:34:38+01:00'
  const mockMessageData = { foo: 'bar' }
  const expectedPublish = {
    TopicArn: mockMessageTopicArn,
    Message: JSON.stringify({
      id: 'mock-uuid',
      source: 'test-source',
      specversion: '1.0',
      type: mockMessageType,
      time: mockMessageTime,
      datacontenttype: 'application/json',
      data: mockMessageData
    }),
    MessageGroupId: 'test-service'
  }

  beforeEach(() => {
    uuidv4.mockReturnValue('mock-uuid')
    vi.clearAllMocks()
    config.get.mockImplementation((key) => {
      switch (key) {
        case 'aws.region':
          return 'eu-west-2'
        case 'aws.sns.endpoint':
          return 'http://localhost:4566'
        case 'aws.accessKeyId':
          return 'test-access-key'
        case 'aws.secretAccessKey':
          return 'test-secret-key'
        case 'aws.sns.eventSource':
          return 'test-source'
        case 'aws.sns.maxAttempts':
          return 3
        case 'serviceName':
          return 'test-service'
        default:
          return undefined
      }
    })
  })

  it('publishes a message successfully', async () => {
    mockSend.mockResolvedValueOnce({})

    await publishEvent(
      {
        topicArn: mockMessageTopicArn,
        type: mockMessageType,
        time: mockMessageTime,
        data: mockMessageData
      },
      logger,
      mockClient
    )

    expect(mockSend).toHaveBeenCalledWith(expect.any(PublishCommand))
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Published event to SNS topic')
    )

    expect(PublishCommand).toHaveBeenCalledWith(expectedPublish)
  })

  it('retries on retryable error and succeeds', async () => {
    mockSend
      .mockRejectedValueOnce({
        $metadata: { httpStatusCode: 500 },
        name: 'InternalError',
        message: 'fail'
      })
      .mockResolvedValueOnce({})

    await publishEvent(
      {
        topicArn: mockMessageTopicArn,
        type: mockMessageType,
        time: mockMessageTime,
        data: mockMessageData
      },
      logger,
      mockClient
    )

    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        error: 'fail',
        code: 'InternalError'
      }),
      'Failed to publish event to SNS topic: arn:aws:sns:eu-west-2:123456789012:test-topic type: TestType'
    )
    expect(logger.info).toHaveBeenCalled()

    expect(PublishCommand).toHaveBeenCalledTimes(2)
    PublishCommand.mock.calls.forEach((call) =>
      expect(call[0]).toEqual(expectedPublish)
    )
  })

  it('throws after max retries on persistent error', async () => {
    mockSend.mockRejectedValue({
      $metadata: { httpStatusCode: 500 },
      name: 'InternalError',
      message: 'fail'
    })

    await expect(
      publishEvent(
        {
          topicArn: mockMessageTopicArn,
          type: mockMessageType,
          time: mockMessageTime,
          data: mockMessageData
        },
        logger,
        mockClient
      )
    ).rejects.toMatchObject({
      name: 'InternalError',
      message: 'fail'
    })

    expect(mockSend).toHaveBeenCalledTimes(3)
    expect(logger.error).toHaveBeenCalled()

    expect(PublishCommand).toHaveBeenCalledTimes(3)
    PublishCommand.mock.calls.forEach((call) =>
      expect(call[0]).toEqual(expectedPublish)
    )
  })

  it('does not retry on real error', async () => {
    mockSend.mockRejectedValueOnce({
      $metadata: { httpStatusCode: 400 },
      name: 'BadRequest',
      message: 'bad request'
    })

    await expect(
      publishEvent(
        {
          topicArn: mockMessageTopicArn,
          type: mockMessageType,
          time: mockMessageTime,
          data: mockMessageData
        },
        logger,
        mockClient
      )
    ).rejects.toMatchObject({
      name: 'BadRequest',
      message: 'bad request'
    })

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        error: 'bad request',
        code: 'BadRequest'
      }),
      'Failed to publish event to SNS topic: arn:aws:sns:eu-west-2:123456789012:test-topic type: TestType'
    )

    expect(PublishCommand).toHaveBeenCalledTimes(1)
    expect(PublishCommand).toHaveBeenCalledWith(expectedPublish)
  })
})
