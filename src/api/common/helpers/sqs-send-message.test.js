import { vi, describe, it, expect, beforeEach } from 'vitest'
import { sendMessage } from './sqs-send-message.js'

// Mock dependencies
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid')
}))

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn((key) => {
      switch (key) {
        case 'aws.region':
          return 'eu-west-2'
        case 'sqs.endpoint':
          return 'http://localhost:4566'
        case 'sqs.eventSource':
          return 'test-source'
        case 'serviceName':
          return 'test-service'
        default:
          return undefined
      }
    })
  }
}))

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn()
}))

vi.mock('./sqs-client.js', () => ({
  getSqsClient: vi.fn(() => ({
    send: mockSend
  }))
}))

vi.mock('@aws-sdk/client-sqs', () => ({
  SendMessageCommand: class {
    constructor(args) {
      this.args = args
    }
  }
}))

describe('sqs-send-message', () => {
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }
  })

  it('should successfully send a message to SQS', async () => {
    const queueUrl = 'http://test-queue-url'
    const type = 'test-type'
    const data = { foo: 'bar' }

    mockSend.mockResolvedValueOnce({})

    await sendMessage({ queueUrl, type, data }, mockLogger)

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          QueueUrl: queueUrl,
          MessageGroupId: 'test-service',
          MessageDeduplicationId: 'test-uuid'
        })
      })
    )

    const callArgs = mockSend.mock.calls[0][0].args
    const messageBody = JSON.parse(callArgs.MessageBody)
    expect(messageBody).toEqual({
      id: 'test-uuid',
      source: 'test-source',
      type,
      time: expect.any(String),
      data
    })

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockLogger.info).toHaveBeenCalledTimes(2)
  })

  it('should throw error and log when SQS send fails', async () => {
    const queueUrl = 'http://test-queue-url'
    const type = 'test-type'
    const data = { foo: 'bar' }
    const error = new Error('SQS error')
    error.name = 'TestError'

    mockSend.mockRejectedValueOnce(error)

    await expect(
      sendMessage({ queueUrl, type, data }, mockLogger)
    ).rejects.toThrow('SQS error')

    expect(mockLogger.error).toHaveBeenCalledWith(
      {
        error: 'SQS error',
        code: 'TestError'
      },
      expect.stringContaining('Failed to send message to SQS')
    )
  })

  it('should work without a logger', async () => {
    const queueUrl = 'http://test-queue-url'
    const type = 'test-type'
    const data = { foo: 'bar' }

    mockSend.mockResolvedValueOnce({})

    await expect(sendMessage({ queueUrl, type, data })).resolves.not.toThrow()
    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})
