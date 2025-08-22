const mockDropCollection = jest.fn().mockResolvedValue(true)
const mockPublishEvent = jest.fn().mockResolvedValue(true)

jest.mock('mongoose', () => ({
  connection: { readyState: 1 },
  STATES: { connected: 1 }
}))
jest.mock('~/src/api/common/models/index.js', () => ({
  agreements: {
    db: {
      dropCollection: mockDropCollection
    }
  }
}))
jest.mock('~/src/api/common/helpers/sample-data/index.js', () => ({
  agreements: [{ agreementNumber: 'SFI123456789' }]
}))
jest.mock('~/src/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: mockPublishEvent
}))

describe('seedDatabase', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('waits for mongoose to connect when readyState is not connected (mocks time)', async () => {
    jest.resetModules()
    jest.useFakeTimers()
    // Dynamically mock readyState to simulate connection
    let readyState = 0
    jest.doMock('mongoose', () => ({
      connection: {
        get readyState() {
          return readyState
        }
      },
      STATES: { connected: 1 }
    }))
    // Re-import after mocking
    const { seedDatabase } = await import('./seed-database.js')
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    // Start the seedDatabase call (it will wait for connection)
    const promise = seedDatabase(logger)
    // Fast-forward timers to trigger the wait
    await Promise.resolve()
    jest.advanceTimersByTime(1000)
    await Promise.resolve()
    // Should have logged waiting message
    expect(logger.info).toHaveBeenCalledWith(
      'Waiting for mongoose to connect...'
    )
    // Now set readyState to connected
    readyState = 1
    // Fast-forward again to let the loop exit and finish
    jest.advanceTimersByTime(1000)
    await promise
    jest.useRealTimers()
  })

  test('publishes events for agreements sample data and logs success', async () => {
    const { seedDatabase } = await import('./seed-database.js')
    await seedDatabase(mockLogger)

    expect(mockDropCollection).toHaveBeenCalledWith('agreements')
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Dropped collection 'agreements'"
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Successfully inserted 1 documents into the 'agreements' collection"
    )
    expect(mockPublishEvent).toHaveBeenCalledWith(
      {
        topicArn:
          'arn:aws:sns:eu-west-2:000000000000:grant_application_approved',
        type: 'io.onsite.agreement.application.approved',
        time: expect.any(String),
        data: { agreementNumber: 'SFI123456789' }
      },
      mockLogger
    )
    expect(mockLogger.error).not.toHaveBeenCalled()
  })

  test('should log error on dropCollection failure', async () => {
    const error = new Error('Failed to drop collection')
    mockDropCollection.mockRejectedValueOnce(error)

    const { seedDatabase } = await import('./seed-database.js')
    await seedDatabase(mockLogger)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Error dropping collection 'agreements': Failed to drop collection"
    )
  })

  test('should log error on publishEvent failure', async () => {
    const error = new Error('Failed to insert document')
    mockPublishEvent.mockRejectedValueOnce(error)

    const { seedDatabase } = await import('./seed-database.js')
    await seedDatabase(mockLogger)

    expect(mockLogger.error).toHaveBeenCalledWith(error)
  })
})
