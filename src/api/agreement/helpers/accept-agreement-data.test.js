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

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should successfully accept an agreement', async () => {
    // Arrange
    const agreementId = '123'
    const username = 'testUser'
    const mockUpdateResult = { modifiedCount: 1 }
    agreementsModel.updateOne.mockResolvedValue(mockUpdateResult)

    // Act
    const result = await acceptAgreement(agreementId, mockLogger, username)

    // Assert
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'agreed',
          signatureDate: expect.any(String),
          username
        }
      }
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Fetching agreement data for agreement ${agreementId}`
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Successfully accepted agreement data for agreement ${agreementId}`
    )
    expect(result).toEqual(mockUpdateResult)
  })

  it('should handle sample agreement ID correctly', async () => {
    // Arrange
    const agreementId = 'sample'
    const username = 'testUser'
    const mockUpdateResult = { modifiedCount: 1 }
    agreementsModel.updateOne.mockResolvedValue(mockUpdateResult)
    process.env.NODE_ENV = 'development'

    // Act
    await acceptAgreement(agreementId, mockLogger, username)

    // Assert
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { agreementNumber: 'SFI123456789' },
      {
        $set: {
          status: 'agreed',
          signatureDate: expect.any(String),
          username
        }
      }
    )
  })

  it('should not use sample ID in production environment', async () => {
    // Arrange
    const agreementId = 'sample'
    const username = 'testUser'
    const mockUpdateResult = { modifiedCount: 1 }
    agreementsModel.updateOne.mockResolvedValue(mockUpdateResult)
    process.env.NODE_ENV = 'production'

    // Act
    await acceptAgreement(agreementId, mockLogger, username)

    // Assert
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { agreementNumber: 'sample' },
      {
        $set: {
          status: 'agreed',
          signatureDate: expect.any(String),
          username
        }
      }
    )
  })

  it('should throw Boom.notFound when agreement is not found', async () => {
    // Arrange
    const agreementId = '123'
    const username = 'testUser'
    agreementsModel.updateOne.mockResolvedValue(null)

    // Act & Assert
    await expect(
      acceptAgreement(agreementId, mockLogger, username)
    ).rejects.toThrow('Agreement not found')
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Agreement not found for agreement ${agreementId}`
    )
  })

  it('should handle database errors and log them', async () => {
    // Arrange
    const agreementId = '123'
    const username = 'testUser'
    const dbError = new Error('Database error')
    agreementsModel.updateOne.mockRejectedValue(dbError)

    // Act & Assert
    await expect(
      acceptAgreement(agreementId, mockLogger, username)
    ).rejects.toThrow('Failed to accept agreement data')
    expect(mockLogger.error).toHaveBeenCalledWith(
      `Error accepting agreement data for agreement ${agreementId}`,
      {
        error: dbError.message,
        stack: dbError.stack
      }
    )
  })

  it('should rethrow Boom errors without wrapping', async () => {
    // Arrange
    const agreementId = '123'
    const username = 'testUser'
    const boomError = Boom.badRequest('Database error')
    agreementsModel.updateOne.mockRejectedValue(boomError)

    // Act & Assert
    await expect(
      acceptAgreement(agreementId, mockLogger, username)
    ).rejects.toEqual(boomError)
  })

  it('should handle empty agreementId', async () => {
    // Arrange
    const agreementId = ''
    const username = 'testUser'

    // Act & Assert
    await expect(
      acceptAgreement(agreementId, mockLogger, username)
    ).rejects.toThrow('Agreement ID is required')
  })

  it('should handle undefined agreementId', async () => {
    // Arrange
    const agreementId = undefined
    const username = 'testUser'

    // Act & Assert
    await expect(
      acceptAgreement(agreementId, mockLogger, username)
    ).rejects.toThrow('Agreement ID is required')
  })

  it('should handle empty username', async () => {
    // Arrange
    const agreementId = '123'
    const username = ''

    // Act & Assert
    await expect(
      acceptAgreement(agreementId, mockLogger, username)
    ).rejects.toThrow('Username is required')
  })

  it('should handle undefined username', async () => {
    // Arrange
    const agreementId = '123'
    const username = undefined

    // Act & Assert
    await expect(
      acceptAgreement(agreementId, mockLogger, username)
    ).rejects.toThrow('Username is required')
  })
})
