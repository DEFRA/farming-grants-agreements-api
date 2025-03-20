import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { acceptAgreement } from './accept-agreement-data.js'

jest.mock('~/src/api/common/models/agreements.js')

describe('acceptAgreement in accept-agreement-data', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }

  const mockUpdateResult = {
    acknowledged: true,
    modifiedCount: 1,
    upsertedId: null,
    upsertedCount: 0,
    matchedCount: 1
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('should successfully accept an agreement', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    agreementsModel.updateOne.mockResolvedValue(mockUpdateResult)

    // Act
    const result = await acceptAgreement(agreementId, mockLogger)

    // Assert
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'agreed',
          signatureDate: new Date().toISOString()
        }
      }
    )
    expect(result).toEqual(mockUpdateResult)
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Fetching agreement data for agreement ${agreementId}`
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Successfully accepted agreement data for agreement ${agreementId}`
    )
  })

  test('should handle sample agreement ID correctly', async () => {
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    const agreementId = 'sample'
    agreementsModel.updateOne.mockResolvedValue(mockUpdateResult)

    // Act
    const result = await acceptAgreement(agreementId, mockLogger)

    // Assert
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { agreementNumber: 'SFI123456789' },
      {
        $set: {
          status: 'agreed',
          signatureDate: new Date().toISOString()
        }
      }
    )
    expect(result).toEqual(mockUpdateResult)

    // Cleanup
    process.env.NODE_ENV = originalNodeEnv
  })

  test('should not use sample ID in production environment', async () => {
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const agreementId = 'sample'
    agreementsModel.updateOne.mockResolvedValue(mockUpdateResult)

    // Act
    const result = await acceptAgreement(agreementId, mockLogger)

    // Assert
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'agreed',
          signatureDate: new Date().toISOString()
        }
      }
    )
    expect(result).toEqual(mockUpdateResult)

    // Cleanup
    process.env.NODE_ENV = originalNodeEnv
  })

  test('should throw Boom.notFound when agreement is not found', async () => {
    // Arrange
    const agreementId = 'SFI999999999'
    agreementsModel.updateOne.mockResolvedValue(null)

    // Act & Assert
    await expect(acceptAgreement(agreementId, mockLogger)).rejects.toThrow(
      Boom.notFound('Agreement not found')
    )
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Agreement not found for agreement ${agreementId}`
    )
  })

  test('should handle database errors and log them', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const dbError = new Error('Database connection failed')
    agreementsModel.updateOne.mockRejectedValue(dbError)

    // Act & Assert
    await expect(acceptAgreement(agreementId, mockLogger)).rejects.toThrow(
      Boom.internal('Failed to accept agreement data')
    )

    expect(mockLogger.error).toHaveBeenCalledWith(
      `Error accepting agreement data for agreement ${agreementId}`,
      {
        error: dbError.message,
        stack: dbError.stack
      }
    )
  })

  test('should rethrow Boom errors without wrapping', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const boomError = Boom.badImplementation('Database error')
    agreementsModel.updateOne.mockRejectedValue(boomError)

    // Act & Assert
    await expect(acceptAgreement(agreementId, mockLogger)).rejects.toEqual(
      boomError
    )
  })

  test('should handle empty agreementId', async () => {
    // Arrange
    const agreementId = ''

    // Act & Assert
    await expect(acceptAgreement(agreementId, mockLogger)).rejects.toThrow(
      Boom.badRequest('Agreement ID is required')
    )
  })

  test('should handle undefined agreementId', async () => {
    // Arrange
    const agreementId = undefined

    // Act & Assert
    await expect(acceptAgreement(agreementId, mockLogger)).rejects.toThrow(
      Boom.badRequest('Agreement ID is required')
    )
  })
})
