import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { acceptOffer, getFirstPaymentDate } from './accept-offer.js'

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

describe('getFirstPaymentDate', () => {
  test('returns correct first payment date', () => {
    expect(getFirstPaymentDate('2024-02-15')).toBe('May 2024')
    expect(getFirstPaymentDate('2024-02-31')).toBe('June 2024')
    expect(getFirstPaymentDate('2024-12-26')).toBe('March 2025')
    expect(getFirstPaymentDate('2024-12-27')).toBe('April 2025')
  })

  test('handles invalid date string gracefully', () => {
    expect(getFirstPaymentDate('invalid-date')).toBe('')
  })
})
