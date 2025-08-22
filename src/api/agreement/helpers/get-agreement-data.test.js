import { jest } from '@jest/globals'
import agreementsModel from '~/src/api/common/models/agreements.js'
import {
  getAgreementDataById,
  doesAgreementExist
} from './get-agreement-data.js'

jest.mock('~/src/api/common/models/agreements.js')

describe('getAgreementData', () => {
  const mockLookup = {
    $lookup: {
      from: 'invoices',
      localField: 'agreementNumber',
      foreignField: 'agreementNumber',
      as: 'invoice'
    }
  }

  describe('getAgreementDataById', () => {
    const mockAgreement = {
      agreementNumber: 'SFI123456789',
      agreementName: 'Test Agreement',
      sbi: '106284736',
      company: 'Test Farm Ltd',
      address: '123 Test Lane',
      postcode: 'TE1 1ST',
      username: 'Test User',
      agreementStartDate: '1/1/2024',
      agreementEndDate: '31/12/2026',
      signatureDate: '1/1/2024',
      actions: [
        {
          code: 'TEST1',
          title: 'Test Action',
          startDate: '1/1/2024',
          endDate: '31/12/2026',
          duration: '3 years'
        }
      ],
      parcels: [
        {
          parcelNumber: 'TEST123',
          parcelName: 'Test Parcel',
          totalArea: 1.0,
          activities: []
        }
      ],
      payments: {
        activities: [],
        totalAnnualPayment: 1000,
        yearlyBreakdown: {
          details: [],
          annualTotals: {
            year1: 1000,
            year2: 1000,
            year3: 1000
          },
          totalAgreementPayment: 3000
        }
      }
    }

    beforeEach(() => {
      jest.clearAllMocks()
    })

    test('should throw Boom.badRequest when agreementId is empty', async () => {
      await expect(getAgreementDataById('')).rejects.toThrow(
        'Agreement ID is required'
      )
    })

    test('should throw Boom.badRequest when agreementId is undefined', async () => {
      await expect(getAgreementDataById(undefined)).rejects.toThrow(
        'Agreement ID is required'
      )
    })

    test('should return agreement data when found', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      agreementsModel.aggregate.mockReturnValue({
        catch: jest.fn().mockResolvedValue([mockAgreement])
      })

      // Act
      const result = await getAgreementDataById(agreementId)

      // Assert
      expect(agreementsModel.aggregate).toHaveBeenCalledWith([
        { $match: { agreementNumber: agreementId } },
        mockLookup
      ])
      expect(result).toEqual(mockAgreement)
    })

    test('should throw Boom.notFound when agreement is not found', async () => {
      // Arrange
      const agreementId = 'SFI999999999'
      agreementsModel.aggregate.mockReturnValue({
        catch: jest.fn().mockResolvedValue([])
      })

      // Act & Assert
      await expect(getAgreementDataById(agreementId)).rejects.toThrow(
        `Agreement not found using search terms: ${JSON.stringify({
          agreementNumber: agreementId
        })}`
      )
    })

    test('should handle missing logger gracefully', async () => {
      // Arrange
      const agreementId = 'SFI123456789'
      agreementsModel.aggregate.mockReturnValue({
        catch: jest.fn().mockResolvedValue([mockAgreement])
      })

      // Act
      const result = await getAgreementDataById(agreementId)

      // Assert
      expect(result).toEqual(mockAgreement)
    })
  })

  describe('doesAgreementExist', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    test('should return true when agreement exists', async () => {
      // Arrange
      const searchTerms = { notificationMessageId: 'test-message-id' }
      agreementsModel.aggregate.mockReturnValue({
        catch: jest.fn().mockResolvedValue([{ id: 'existing-agreement' }])
      })

      // Act
      const result = await doesAgreementExist(searchTerms)

      // Assert
      expect(agreementsModel.aggregate).toHaveBeenCalledWith([
        { $match: searchTerms },
        mockLookup
      ])
      expect(result).toBe(true)
    })

    test('should return false when agreement does not exist', async () => {
      // Arrange
      const searchTerms = { notificationMessageId: 'non-existent-message-id' }
      agreementsModel.aggregate.mockReturnValue({
        catch: jest.fn().mockResolvedValue([])
      })

      // Act
      const result = await doesAgreementExist(searchTerms)

      // Assert
      expect(agreementsModel.aggregate).toHaveBeenCalledWith([
        { $match: searchTerms },
        mockLookup
      ])
      expect(result).toBe(false)
    })

    test('should handle database errors gracefully', async () => {
      // Arrange
      const searchTerms = { notificationMessageId: 'test-message-id' }
      const mockError = new Error('Database connection error')
      agreementsModel.aggregate.mockReturnValue({
        catch: jest.fn().mockRejectedValue(mockError)
      })

      // Act & Assert
      await expect(doesAgreementExist(searchTerms)).rejects.toThrow(
        'Database connection error'
      )
    })

    test('should throw Boom.internal when aggregate throws', async () => {
      // Arrange
      const Boom = (await import('@hapi/boom')).default
      const searchTerms = { notificationMessageId: 'boom-test-id' }
      const mockError = new Error('Boom error')
      agreementsModel.aggregate.mockReturnValue({
        catch: jest.fn().mockImplementation((cb) => {
          throw cb(mockError)
        })
      })

      // Act & Assert
      await expect(doesAgreementExist(searchTerms)).rejects.toThrow(Boom.Boom)
    })

    test('should work with different search terms', async () => {
      // Arrange
      const searchTerms = { agreementNumber: 'SFI123456789' }
      agreementsModel.aggregate.mockReturnValue({
        catch: jest.fn().mockResolvedValue([{ id: 'existing-agreement' }])
      })

      // Act
      const result = await doesAgreementExist(searchTerms)

      // Assert
      expect(agreementsModel.aggregate).toHaveBeenCalledWith([
        { $match: searchTerms },
        mockLookup
      ])
      expect(result).toBe(true)
    })
  })
})
