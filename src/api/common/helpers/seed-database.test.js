describe('seedDatabase', () => {
  describe('processMessage', () => {
    const mockProcessMessage = jest.fn()
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    let prevEnv

    beforeEach(() => {
      jest.resetModules()
      jest.clearAllMocks()
      prevEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      // mocks required for this test
      jest.doMock(
        '~/src/api/common/helpers/sqs-message-processor/create-agreement.js',
        () => ({
          handleCreateAgreementEvent: mockProcessMessage
        })
      )

      jest.doMock('mongoose', () => {
        const mockSchema = jest.fn().mockImplementation(() => ({
          add: jest.fn(),
          pre: jest.fn(),
          post: jest.fn(),
          methods: {},
          statics: {},
          virtuals: {},
          indexes: [],
          index: jest.fn()
        }))
        mockSchema.Types = {
          ObjectId: jest.fn()
        }
        return {
          connection: { readyState: 1 },
          STATES: { connected: 1 },
          Schema: mockSchema,
          model: jest.fn().mockImplementation(() => ({
            find: jest.fn(),
            findOne: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            updateOne: jest.fn(),
            updateMany: jest.fn(),
            deleteOne: jest.fn(),
            deleteMany: jest.fn(),
            countDocuments: jest.fn(),
            aggregate: jest.fn(),
            distinct: jest.fn()
          }))
        }
      })

      jest.doMock('~/src/api/common/models/index.js', () => ({
        __esModule: true,
        default: {
          agreements: {
            db: {
              dropCollection: jest.fn().mockResolvedValue(true)
            }
          }
        }
      }))

      jest.doMock('~/src/api/common/helpers/sample-data/index.js', () => ({
        __esModule: true,
        default: {
          agreements: [{ id: 'abc123', foo: 'bar' }]
        }
      }))
    })

    afterEach(() => {
      process.env.NODE_ENV = prevEnv
    })

    it('calls processMessage with correct values via seedDatabase', async () => {
      // Reset modules to ensure mocks are applied
      jest.resetModules()

      const { seedDatabase } = await import('./seed-database.js')
      await seedDatabase(logger)

      expect(mockProcessMessage).toHaveBeenCalledWith(
        expect.any(String), // MessageId generated in publishEvent
        {
          id: expect.any(String),
          datacontenttype: 'application/json',
          specversion: '1.0',
          source: 'urn:service:agreement',
          time: expect.any(String),
          type: 'cloud.defra.test.fg-gas-backend.agreement.create',
          data: {
            foo: 'bar',
            id: 'abc123'
          }
        },
        logger
      )
    })
  })

  describe('seedDatabase core behavior', () => {
    let mockLogger
    let mockDropCollection
    let mockPublishEvent
    let prevEnv

    beforeEach(() => {
      jest.resetModules()
      jest.clearAllMocks()

      prevEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }

      // default mocks (tests can override behavior via mock.*.mockRejectedValueOnce or by calling jest.doMock again)
      mockDropCollection = jest.fn().mockResolvedValue(true)
      mockPublishEvent = jest.fn().mockResolvedValue(true)

      // default mongoose mock (tests that need custom readyState can override with their own jest.doMock)
      jest.doMock('mongoose', () => {
        const mockSchema = jest.fn().mockImplementation(() => ({
          add: jest.fn(),
          pre: jest.fn(),
          post: jest.fn(),
          methods: {},
          statics: {},
          virtuals: {},
          indexes: [],
          index: jest.fn()
        }))
        mockSchema.Types = {
          ObjectId: jest.fn()
        }
        return {
          connection: { readyState: 1 },
          STATES: { connected: 1 },
          Schema: mockSchema,
          model: jest.fn().mockImplementation(() => ({
            find: jest.fn(),
            findOne: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            updateOne: jest.fn(),
            updateMany: jest.fn(),
            deleteOne: jest.fn(),
            deleteMany: jest.fn(),
            countDocuments: jest.fn(),
            aggregate: jest.fn(),
            distinct: jest.fn()
          }))
        }
      })

      jest.doMock('~/src/api/common/models/index.js', () => ({
        agreements: {
          db: {
            dropCollection: mockDropCollection
          }
        }
      }))

      jest.doMock('~/src/api/common/helpers/sample-data/index.js', () => ({
        agreements: [{ agreementNumber: 'SFI123456789' }]
      }))

      jest.doMock('~/src/api/common/helpers/sns-publisher.js', () => ({
        publishEvent: mockPublishEvent
      }))
    })

    afterEach(() => {
      process.env.NODE_ENV = prevEnv
    })

    test('waits for mongoose to connect when readyState is not connected (mocks time)', async () => {
      jest.useFakeTimers()
      // Dynamically mock readyState to simulate connection
      let readyState = 0
      // override the default mongoose mock to use a dynamic readyState getter
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
      // use the shared mocks created in beforeEach
      const { seedDatabase } = await import('./seed-database.js')
      await seedDatabase(mockLogger)

      expect(mockDropCollection).toHaveBeenCalledWith('agreements')
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Dropped collection 'agreements'"
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Successfully published 1 'agreements' documents"
      )
      expect(mockPublishEvent).toHaveBeenCalledWith(
        {
          topicArn:
            'arn:aws:sns:eu-west-2:000000000000:grant_application_approved',
          type: 'cloud.defra.test.fg-gas-backend.agreement.create',
          time: expect.any(String),
          data: { agreementNumber: 'SFI123456789' }
        },
        mockLogger,
        expect.objectContaining({ send: expect.any(Function) })
      )
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    test('should log error on dropCollection failure', async () => {
      const error = new Error('Failed to drop collection')
      // make the shared mock reject for this test
      mockDropCollection.mockRejectedValueOnce(error)

      const { seedDatabase } = await import('./seed-database.js')
      await seedDatabase(mockLogger)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Error dropping collection 'agreements': Failed to drop collection"
      )
    })

    test('should log error on publishEvent failure', async () => {
      const error = new Error('Failed to insert document')
      // make the shared publishEvent mock reject for this test
      mockPublishEvent.mockRejectedValueOnce(error)

      const { seedDatabase } = await import('./seed-database.js')
      await seedDatabase(mockLogger)

      expect(mockLogger.error).toHaveBeenCalledWith(error)
    })

    test('accepts a custom tableData parameter and publishes provided data', async () => {
      const { seedDatabase } = await import('./seed-database.js')
      const customTableData = [
        { agreementNumber: 'CUST1' },
        { agreementNumber: 'CUST2' }
      ]

      await seedDatabase(mockLogger, customTableData)

      expect(mockPublishEvent).toHaveBeenCalledTimes(2)
      expect(mockPublishEvent).toHaveBeenCalledWith(
        {
          topicArn:
            'arn:aws:sns:eu-west-2:000000000000:grant_application_approved',
          type: 'cloud.defra.test.fg-gas-backend.agreement.create',
          time: expect.any(String),
          data: { agreementNumber: 'CUST1' }
        },
        mockLogger,
        expect.objectContaining({ send: expect.any(Function) })
      )
      expect(mockPublishEvent).toHaveBeenCalledWith(
        {
          topicArn:
            'arn:aws:sns:eu-west-2:000000000000:grant_application_approved',
          type: 'cloud.defra.test.fg-gas-backend.agreement.create',
          time: expect.any(String),
          data: { agreementNumber: 'CUST2' }
        },
        mockLogger,
        expect.objectContaining({ send: expect.any(Function) })
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Successfully published 2 'agreements' documents"
      )
    })
  })

  describe('contract test data seeding', () => {
    let prevEnv
    let mockLogger
    const mockProcessMessage = jest.fn()

    beforeEach(() => {
      jest.resetModules()
      jest.clearAllMocks()

      prevEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'test'

      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }

      jest.doMock(
        '~/src/api/common/helpers/sqs-message-processor/create-agreement.js',
        () => ({
          handleCreateAgreementEvent: mockProcessMessage
        })
      )

      jest.doMock('~/src/api/common/helpers/sample-data/index.js', () => ({
        agreements: [
          {
            notificationMessageId: 'mockNotificationMessageId',
            agreementNumber: 'SFI123456789'
          }
        ]
      }))
    })

    afterEach(() => {
      process.env.NODE_ENV = prevEnv
    })

    test('calls handleCreateAgreementEvent correctly for contract tests', async () => {
      const { seedDatabase } = await import('./seed-database.js')
      await seedDatabase(mockLogger)

      expect(mockProcessMessage).toHaveBeenCalledWith(
        'mockNotificationMessageId',
        {
          topicArn:
            'arn:aws:sns:eu-west-2:000000000000:grant_application_approved',
          time: expect.any(String),
          type: 'cloud.defra.test.fg-gas-backend.agreement.create',
          data: {
            notificationMessageId: 'mockNotificationMessageId',
            agreementNumber: 'SFI123456789'
          }
        },
        mockLogger
      )
    })
  })
})
