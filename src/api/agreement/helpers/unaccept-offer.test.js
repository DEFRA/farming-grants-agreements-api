import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { unacceptOffer } from './unaccept-offer.js'

jest.mock('~/src/api/common/models/agreements.js')

describe('unacceptOffer', () => {
  const mockUpdateResult = {
    acknowledged: true,
    modifiedCount: 1,
    upsertedId: null,
    upsertedCount: 0,
    matchedCount: 1
  }

  beforeAll(() => {
    jest.useFakeTimers()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.setSystemTime(new Date('2024-01-01'))
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  test('should successfully unaccept an agreement', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    agreementsModel.updateOne.mockResolvedValue(mockUpdateResult)

    // Act
    const result = await unacceptOffer(agreementId)

    // Assert
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'offered',
          signatureDate: null
        }
      }
    )
    expect(result).toEqual(mockUpdateResult)
  })

  test('should not use sample ID in production environment', async () => {
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const agreementId = 'sample'
    agreementsModel.updateOne.mockResolvedValue(mockUpdateResult)

    // Act
    const result = await unacceptOffer(agreementId)

    // Assert
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'offered',
          signatureDate: null
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
    await expect(unacceptOffer(agreementId)).rejects.toThrow(
      Boom.notFound('Agreement not found with ID SFI999999999')
    )
  })

  test('should handle database errors and log them', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const dbError = Boom.internal('Database connection failed')
    agreementsModel.updateOne.mockRejectedValue(dbError)

    // Act & Assert
    await expect(unacceptOffer(agreementId)).rejects.toThrow(
      Boom.internal('Database connection failed')
    )
  })

  test('should rethrow Boom errors without wrapping', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const boomError = Boom.badImplementation('Database error')
    agreementsModel.updateOne.mockRejectedValue(boomError)

    // Act & Assert
    await expect(unacceptOffer(agreementId)).rejects.toEqual(boomError)
  })
})
