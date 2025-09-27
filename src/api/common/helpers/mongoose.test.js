import { jest } from '@jest/globals'
import mongoose from 'mongoose'
import { config } from '~/src/config/index.js'
import { seedDatabase } from './seed-database.js'
import { mongooseDb } from './mongoose.js'

// Mock dependencies
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  connection: {}
}))

jest.mock('~/src/config/index.js', () => ({
  config: {
    get: jest.fn()
  }
}))

jest.mock('./seed-database.js', () => ({
  seedDatabase: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('~/src/api/common/models/agreements.js', () => ({}))
jest.mock('~/src/api/common/models/versions.js', () => ({}))
jest.mock('~/src/api/common/models/index.js', () => ({}))

// Get the mocked functions with proper typing
const mockMongoose = jest.mocked(mongoose)
const mockConfig = jest.mocked(config)
const mockSeedDatabase = jest.mocked(seedDatabase)

describe('mongooseDb', () => {
  let mockServer
  let mockLogger
  let mockOptions

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }

    mockServer = {
      logger: mockLogger,
      decorate: jest.fn(),
      events: {
        on: jest.fn()
      }
    }

    mockOptions = {
      mongoUrl: 'mongodb://localhost:27017',
      databaseName: 'test-db'
    }

    // Reset mocks
    jest.clearAllMocks()
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
        {
          error: 'Seed failed',
          stack: seedError.stack
        },
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
