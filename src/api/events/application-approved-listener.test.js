import * as sqsModule from '@aws-sdk/client-sqs'

// Setup a mock logger object
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

// Mock the logger module to always return our mockLogger
jest.mock('~/src/api/common/helpers/logging/logger.js', () => ({
  createLogger: () => mockLogger
}))

describe('pollQueue', () => {
  let sendMock
  let pollQueue

  beforeAll(async () => {
    jest.useFakeTimers()

    // Mock SQSClient.send to return different results based on the command
    sendMock = jest.fn((command) => {
      if (command instanceof sqsModule.GetQueueAttributesCommand) {
        return Promise.resolve({}) // Simulate successful queue verification
      }
      if (command instanceof sqsModule.ReceiveMessageCommand) {
        return Promise.resolve({ Messages: undefined }) // Simulate empty queue
      }
      return Promise.resolve({})
    })
    sqsModule.SQSClient.prototype.send = sendMock

    // Reset modules and import pollQueue after mocks are set up
    jest.resetModules()
    pollQueue = (await import('./application-approved-listener.js')).pollQueue
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    // Reset logger mocks before each test
    mockLogger.info.mockClear()
    mockLogger.warn.mockClear()
    mockLogger.error.mockClear()
  })

  it('runs without throwing', async () => {
    const intervalId = await pollQueue()
    jest.runOnlyPendingTimers()
    clearInterval(intervalId)
    expect(intervalId).toBeDefined()
  })
})
