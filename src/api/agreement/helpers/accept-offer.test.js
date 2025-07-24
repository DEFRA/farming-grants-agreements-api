import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { acceptOffer, getNextQuarter } from './accept-offer.js'

jest.mock('~/src/api/common/models/agreements.js')

describe('acceptOffer', () => {
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

  test('should successfully accept an agreement', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    agreementsModel.updateOne.mockResolvedValue(mockUpdateResult)

    // Act
    const result = await acceptOffer(agreementId)

    // Assert
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'accepted',
          signatureDate: new Date().toISOString()
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
    const result = await acceptOffer(agreementId)

    // Assert
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      {
        $set: {
          status: 'accepted',
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
    await expect(acceptOffer(agreementId)).rejects.toThrow(
      Boom.notFound('Offer not found with ID SFI999999999')
    )
  })

  test('should handle database errors and log them', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const dbError = Boom.internal('Database connection failed')
    agreementsModel.updateOne.mockRejectedValue(dbError)

    // Act & Assert
    await expect(acceptOffer(agreementId)).rejects.toThrow(
      Boom.internal('Database connection failed')
    )
  })

  test('should rethrow Boom errors without wrapping', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const boomError = Boom.badImplementation('Database error')
    agreementsModel.updateOne.mockRejectedValue(boomError)

    // Act & Assert
    await expect(acceptOffer(agreementId)).rejects.toEqual(boomError)
  })
})

describe('getNextQuarter', () => {
  test('returns correct next quarter for Q1', () => {
    expect(getNextQuarter('2024-01-15')).toBe('April 2024')
    expect(getNextQuarter('2024-03-31')).toBe('April 2024')
  })

  test('returns correct next quarter for Q2', () => {
    expect(getNextQuarter('2024-04-01')).toBe('July 2024')
    expect(getNextQuarter('2024-06-30')).toBe('July 2024')
  })

  test('returns correct next quarter for Q3', () => {
    expect(getNextQuarter('2024-07-01')).toBe('October 2024')
    expect(getNextQuarter('2024-09-30')).toBe('October 2024')
  })

  test('returns correct next quarter for Q4 and rolls over year', () => {
    expect(getNextQuarter('2024-10-01')).toBe('January 2025')
    expect(getNextQuarter('2024-12-31')).toBe('January 2025')
  })

  test('handles invalid date string gracefully', () => {
    expect(getNextQuarter('invalid-date')).toBe('Invalid Date')
  })
})
