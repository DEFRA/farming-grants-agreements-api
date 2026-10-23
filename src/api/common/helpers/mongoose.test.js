import { vi } from 'vitest'
import mongoose from 'mongoose'
import { config } from '#~/config/index.js'
import { seedDatabase } from './seed-database.js'
import { mongooseDb } from './mongoose.js'

/** @import { Server } from '@hapi/hapi' */

// Mock dependencies
vi.mock('mongoose', () => {
  class MockSchema {
    constructor() {
      this.index = vi.fn()
      this.statics = {}
      this.methods = {}
      this.pre = vi.fn()
      this.post = vi.fn()
    }
  }
  MockSchema.Types = {
    ObjectId: String,
    Mixed: Object
  }
  return {
    __esModule: true,
    default: {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      connection: {},
      Schema: MockSchema,
      model: vi.fn().mockReturnValue({})
    }
  }
})

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'log') {
        return {
          enabled: true,
          level: 'info',
          format: 'pino-pretty',
          redact: []
        }
      }
      if (key === 'serviceName') return 'test-service'
      if (key === 'serviceVersion') return '1.0.0'
      return undefined
    })
  }
}))

vi.mock('./seed-database.js', () => ({
  seedDatabase: vi.fn().mockResolvedValue(undefined)
}))

// Get the mocked functions with proper typing
const mockMongoose = vi.mocked(mongoose)
const mockConfig = vi.mocked(config)
const mockSeedDatabase = vi.mocked(seedDatabase)

describe('mongooseDb', () => {
  let mockServer
  let mockLogger
  let mockOptions
  /** @type {Record<string, unknown>} */
  let configValues

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    mockServer = {
      logger: mockLogger,
      decorate: vi.fn(),
      events: {
        on: vi.fn()
      }
    }

    mockOptions = {
      mongoUrl: 'mongodb://localhost:27017',
      databaseName: 'test-db'
    }

    configValues = {
      mongoUri: mockOptions.mongoUrl,
      mongoDatabase: mockOptions.databaseName,
      'featureFlags.seedDb': false,
      log: {
        enabled: true,
        level: 'info',
        format: 'pino-pretty',
        redact: []
      }
    }

    // Reset mocks
    vi.clearAllMocks()

    mockConfig.get.mockImplementation((key) => configValues[key])
  })

  test('plugin should have correct name and version metadata', () => {
    expect(mongooseDb.plugin.name).toBe('mongoose')
    expect(mongooseDb.plugin.version).toBe('1.0.0')
  })

  describe('register function', () => {
    test('should connect to MongoDB and set up server decorator', async () => {
      // Act
      /** @type {Server} */
      const server = mockServer
      await mongooseDb.plugin.register(server, mockOptions)

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('Setting up Mongoose')
      expect(mockMongoose.connect).toHaveBeenCalledWith(mockOptions.mongoUrl, {
        dbName: mockOptions.databaseName,
        serverSelectionTimeoutMS: expect.any(Number),
        socketTimeoutMS: expect.any(Number)
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Mongoose connected to MongoDB'
      )
      expect(mockServer.decorate).toHaveBeenCalledWith(
        'server',
        'mongooseDb',
        mockMongoose.connection
      )
    })

    test('should fall back to config when options are not provided', async () => {
      /** @type {Server} */
      const server = mockServer
      await mongooseDb.plugin.register(server)

      expect(mockMongoose.connect).toHaveBeenCalledWith(configValues.mongoUri, {
        dbName: configValues.mongoDatabase,
        serverSelectionTimeoutMS: expect.any(Number),
        socketTimeoutMS: expect.any(Number)
      })
    })

    test('should seed database when feature flag is enabled', async () => {
      // Arrange
      configValues['featureFlags.seedDb'] = true
      mockSeedDatabase.mockResolvedValue(undefined)

      // Act
      /** @type {Server} */
      const server = mockServer
      await mongooseDb.plugin.register(server, mockOptions)

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'featureFlags.seedDb is enabled. This should not be enabled in production.'
      )
      expect(mockSeedDatabase).toHaveBeenCalledWith(mockLogger)
    })

    test('should not seed database when feature flag is disabled', async () => {
      // Act
      /** @type {Server} */
      const server = mockServer
      await mongooseDb.plugin.register(server, mockOptions)

      // Assert
      expect(mockLogger.warn).not.toHaveBeenCalled()
      expect(mockSeedDatabase).not.toHaveBeenCalled()
    })

    test('should handle seed database errors gracefully', async () => {
      // Arrange
      configValues['featureFlags.seedDb'] = true
      const seedError = new Error('Seed failed')
      mockSeedDatabase.mockRejectedValue(seedError)

      // Act
      /** @type {Server} */
      const server = mockServer
      await mongooseDb.plugin.register(server, mockOptions)

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        seedError,
        'Error seeding database failed:'
      )
    })

    test('should set up server stop event handler', async () => {
      // Act
      /** @type {Server} */
      const server = mockServer
      await mongooseDb.plugin.register(server, mockOptions)

      // Assert
      expect(mockServer.events.on).toHaveBeenCalledWith(
        'stop',
        expect.any(Function)
      )

      // Test the stop event handler
      const stopHandler = mockServer.events.on.mock.calls[0][1]
      await stopHandler()

      expect(mockLogger.info).toHaveBeenCalledWith('Closing Mongoose client')
      expect(mockMongoose.disconnect).toHaveBeenCalled()
    })

    test('should handle mongoose connection errors', async () => {
      // Arrange
      const connectionError = new Error('Connection failed')
      mockMongoose.connect.mockRejectedValue(connectionError)

      // Act & Assert
      /** @type {Server} */
      const server = mockServer
      await expect(
        mongooseDb.plugin.register(server, mockOptions)
      ).rejects.toThrow('Connection failed')

      expect(mockMongoose.connect).toHaveBeenCalled()
    })
  })
})
