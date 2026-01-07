import { vi } from 'vitest'
import mongoose from 'mongoose'
import { config } from '~/src/config/index.js'
import { seedDatabase } from './seed-database.js'
import { mongooseDb } from './mongoose.js'

// Mock dependencies
vi.mock('mongoose', () => ({
  __esModule: true,
  default: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    connection: {}
  }
}))

vi.mock('~/src/config/index.js', () => ({
  config: {
    get: vi.fn()
  }
}))

vi.mock('./seed-database.js', () => ({
  seedDatabase: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('~/src/api/common/models/agreements.js', () => ({
  __esModule: true,
  default: {}
}))
vi.mock('~/src/api/common/models/versions.js', () => ({
  __esModule: true,
  default: {}
}))
vi.mock('~/src/api/common/models/index.js', () => ({
  __esModule: true,
  default: {}
}))

// Get the mocked functions with proper typing
const mockMongoose = vi.mocked(mongoose)
const mockConfig = vi.mocked(config)
const mockSeedDatabase = vi.mocked(seedDatabase)

describe('mongooseDb', () => {
  let mockServer
  let mockLogger
  let mockOptions

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

    // Reset mocks
    vi.clearAllMocks()
  })

  describe('plugin registration', () => {
    test('should have correct plugin name and version', () => {
      expect(mongooseDb.plugin.name).toBe('mongoose')
      expect(mongooseDb.plugin.version).toBe('1.0.0')
    })

    test('should have correct options from config', () => {
      expect(mongooseDb.options.mongoUrl).toBe(mockConfig.get('mongoUri'))
      expect(mongooseDb.options.databaseName).toBe(
        mockConfig.get('mongoDatabase')
      )
    })
  })

  describe('register function', () => {
    test('should connect to MongoDB and set up server decorator', async () => {
      // Act
      await Promise.resolve(mongooseDb.plugin.register(mockServer, mockOptions))

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('Setting up Mongoose')
      expect(mockMongoose.connect).toHaveBeenCalledWith(mockOptions.mongoUrl, {
        dbName: mockOptions.databaseName
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

    test('should seed database when feature flag is enabled', async () => {
      // Arrange
      mockConfig.get.mockReturnValue(true)
      mockSeedDatabase.mockResolvedValue(undefined)

      // Act
      await Promise.resolve(mongooseDb.plugin.register(mockServer, mockOptions))

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'featureFlags.seedDb is enabled. This should not be enabled in production.'
      )
      expect(mockSeedDatabase).toHaveBeenCalledWith(mockLogger)
    })

    test('should not seed database when feature flag is disabled', async () => {
      // Arrange
      mockConfig.get.mockReturnValue(false)

      // Act
      await Promise.resolve(mongooseDb.plugin.register(mockServer, mockOptions))

      // Assert
      expect(mockLogger.warn).not.toHaveBeenCalled()
      expect(mockSeedDatabase).not.toHaveBeenCalled()
    })

    test('should handle seed database errors gracefully', async () => {
      // Arrange
      mockConfig.get.mockReturnValue(true)
      const seedError = new Error('Seed failed')
      mockSeedDatabase.mockRejectedValue(seedError)

      // Act
      await Promise.resolve(mongooseDb.plugin.register(mockServer, mockOptions))

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        seedError,
        'Error seeding database failed:'
      )
    })

    test('should set up server stop event handler', async () => {
      // Act
      await Promise.resolve(mongooseDb.plugin.register(mockServer, mockOptions))

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
      await expect(
        mongooseDb.plugin.register(mockServer, mockOptions)
      ).rejects.toThrow('Connection failed')
    })
  })
})
