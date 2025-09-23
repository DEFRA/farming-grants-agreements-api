import { jest } from '@jest/globals'
import versionsModel from '~/src/api/common/models/versions.js'
import agreementsModel from '~/src/api/common/models/agreements.js'
import {
  doesAgreementExist,
  getAgreementDataById
} from './get-agreement-data.js'

jest.mock('~/src/api/common/models/versions.js')
jest.mock('~/src/api/common/models/agreements.js')

describe('getAgreementDataById', () => {
  const mockAgreement = {
    agreementNumber: 'SFI123456789',
    agreementName: 'Test Agreement',
    signatureDate: '1/1/2024'
  }

  const mockGroup = {
    _id: '507f1f77bcf86cd799439011',
    agreementNumber: 'SFI123456789',
    agreementName: 'Test Agreement'
  }

  const expectedLookup = {
    $lookup: {
      from: 'invoices',
      localField: 'agreementNumber',
      foreignField: 'agreementNumber',
      as: 'invoice'
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should throw Boom.badRequest when agreementId is undefined', async () => {
    await expect(getAgreementDataById(undefined)).rejects.toThrow(
      'Agreement ID is required'
    )
  })

  test('should throw Boom.notFound when agreement group is not found', async () => {
    const agreementId = 'SFI999999999'

    agreementsModel.aggregate.mockReturnValue({
      catch: jest.fn().mockResolvedValue([])
    })

    await expect(getAgreementDataById(agreementId)).rejects.toThrow(
      `Agreement not found using search terms: ${JSON.stringify({
        agreementNumber: agreementId
      })}`
    )

    expect(agreementsModel.aggregate).toHaveBeenCalledWith([
      { $match: { agreementNumber: agreementId } },
      expectedLookup,
      { $limit: 1 }
    ])
    expect(versionsModel.findOne).not.toHaveBeenCalled()
  })

  test('should return agreement data when found', async () => {
    // Arrange
    const agreementId = 'SFI123456789'

    agreementsModel.aggregate.mockReturnValue({
      catch: jest.fn().mockResolvedValue([
        {
          ...mockGroup,
          invoice: [{ test: 'invoice' }],
          versions: [{ version: '1123' }]
        }
      ])
    })

    versionsModel.findOne.mockReturnValue({
      sort: () => ({
        lean: () => Promise.resolve({ ...mockAgreement })
      })
    })

    // Act
    const result = await getAgreementDataById(agreementId)

    // Assert
    expect(agreementsModel.aggregate).toHaveBeenCalledWith([
      { $match: { agreementNumber: agreementId } },
      expectedLookup,
      { $limit: 1 }
    ])
    expect(versionsModel.findOne).toHaveBeenCalledWith({
      agreement: mockGroup._id
    })
    expect(result).toEqual({
      ...mockAgreement,
      agreementNumber: mockGroup.agreementNumber,
      invoice: [{ test: 'invoice' }],
      version: 1
    })
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
      catch: jest.fn().mockResolvedValue([{ ...mockGroup, invoice: [] }])
    })

    versionsModel.findOne.mockReturnValue({
      sort: () => ({
        lean: () => Promise.resolve({ ...mockAgreement })
      })
    })

    // Act
    const result = await getAgreementDataById(agreementId)

    // Assert
    expect(result).toEqual({
      ...mockAgreement,
      agreementNumber: mockGroup.agreementNumber,
      invoice: [],
      version: 1
    })
  })
})

describe('doesAgreementExist', () => {
  const mockLookup = {
    $lookup: {
      from: 'invoices',
      localField: 'agreementNumber',
      foreignField: 'agreementNumber',
      as: 'invoice'
    }
  }

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
      mockLookup,
      { $limit: 1 }
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
      mockLookup,
      { $limit: 1 }
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
      mockLookup,
      { $limit: 1 }
    ])
    expect(result).toBe(true)
  })
})
