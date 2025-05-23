import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { getAgreementData } from './get-agreement-data.js'

jest.mock('~/src/api/common/models/agreements.js')

describe('getAgreementData', () => {
  const mockAgreement = {
    agreementNumber: 'SFI123456789',
    agreementName: 'Test Agreement',
    sbi: '123456789',
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

  test('should return agreement data when found', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    agreementsModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockAgreement)
    })

    // Act
    const result = await getAgreementData({ agreementNumber: agreementId })

    // Assert
    expect(agreementsModel.findOne).toHaveBeenCalledWith({
      agreementNumber: agreementId
    })
    expect(result).toEqual(mockAgreement)
  })

  test('should throw Boom.notFound when agreement is not found', async () => {
    // Arrange
    const agreementId = 'SFI999999999'
    agreementsModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    })

    // Act & Assert
    await expect(
      getAgreementData({ agreementNumber: agreementId })
    ).rejects.toThrow(
      Boom.notFound(
        `Agreement not found using search terms: ${JSON.stringify({
          agreementNumber: agreementId
        })}`
      )
    )
  })

  test('should handle missing logger gracefully', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    agreementsModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockAgreement)
    })

    // Act
    const result = await getAgreementData({ agreementNumber: agreementId })

    // Assert
    expect(result).toEqual(mockAgreement)
  })
})
