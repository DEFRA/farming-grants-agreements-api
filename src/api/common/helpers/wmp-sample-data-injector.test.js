import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import mongoose from 'mongoose'
import { ObjectId } from 'mongodb'
import {
  injectSampleWMPData,
  injectUnhappyData
} from './wmp-sample-data-injector.js'

// Mock the logger
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('#~/api/common/helpers/logging/logger.js', () => ({
  createLogger: () => mockLogger
}))

describe('wmp-sample-data-injector.js', () => {
  let mockCollection

  beforeEach(() => {
    vi.clearAllMocks()

    mockCollection = {
      findOne: vi.fn(),
      insertOne: vi.fn(),
      insertMany: vi.fn(),
      deleteOne: vi.fn(),
      deleteMany: vi.fn(),
      updateOne: vi.fn()
    }

    vi.spyOn(mongoose.connection, 'collection').mockReturnValue(mockCollection)
    vi.spyOn(mongoose, 'connect').mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('injectSampleWMPData', () => {
    it('should inject happy path data successfully', async () => {
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        // intentionally empty
      })

      await injectSampleWMPData()

      expect(mockCollection.deleteMany).toHaveBeenCalled()
      expect(mockCollection.insertOne).toHaveBeenCalledTimes(2)
      expect(mockCollection.insertMany).toHaveBeenCalledTimes(1)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Successfully injected happy path Woodland data.'
      )
    })

    it('should handle errors during happy path injection', async () => {
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })
      mockCollection.deleteMany.mockRejectedValue(new Error('DB Error'))

      await injectSampleWMPData()

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Injection failed:',
        expect.any(Error)
      )
    })
  })

  describe('injectUnhappyData', () => {
    it('should inject unhappy path data successfully', async () => {
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 0, // Test connection logic
        configurable: true
      })

      mockCollection.findOne.mockResolvedValue(null) // No existing grant

      await injectUnhappyData()

      expect(mongoose.connect).toHaveBeenCalled()
      expect(mockCollection.insertOne).toHaveBeenCalledTimes(2)
      expect(mockCollection.insertMany).toHaveBeenCalledTimes(1)
      expect(mockCollection.updateOne).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully injected unhappy path data.'
      )
    })

    it('should clean up existing grant before injecting unhappy data', async () => {
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })

      const existingGrantId = new ObjectId()
      mockCollection.findOne.mockResolvedValue({ _id: existingGrantId })

      await injectUnhappyData()

      expect(mockCollection.deleteMany).toHaveBeenCalledWith({
        grant: existingGrantId
      })
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({
        _id: existingGrantId
      })
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({
        agreementNumber: 'WMP_UNHAPPY'
      })
    })

    it('should handle errors during unhappy path injection', async () => {
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      })
      mockCollection.findOne.mockRejectedValue(new Error('DB Error'))

      await injectUnhappyData()

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Injection failed:',
        expect.any(Error)
      )
    })
  })
})
