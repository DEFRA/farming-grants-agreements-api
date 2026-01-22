import { vi } from 'vitest'
import Boom from '@hapi/boom'
import versionsModel from '~/src/api/common/models/versions.js'
import agreementsModel from '~/src/api/common/models/agreements.js'
import {
  doesAgreementExist,
  getAgreementDataById,
  getAgreementDataBySbi
} from './get-agreement-data.js'

vi.mock('@hapi/boom')
vi.mock('~/src/api/common/models/versions.js')
vi.mock('~/src/api/common/models/agreements.js')

describe('getAgreementDataById', () => {
  const mockAgreement = {
    agreementNumber: 'FPTT123456789',
    agreementName: 'Test Agreement',
    signatureDate: '1/1/2024'
  }

  const mockGroup = {
    _id: '507f1f77bcf86cd799439011',
    agreementNumber: 'FPTT123456789',
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
    vi.clearAllMocks()

    // Setup Boom mocks
    Boom.badRequest = vi.fn((message) => {
      const error = new Error(message)
      error.isBoom = true
      return error
    })
    Boom.notFound = vi.fn((message) => {
      const error = new Error(message)
      error.isBoom = true
      return error
    })
    Boom.internal = vi.fn((error) => {
      const boomError = new Error(error?.message || 'Internal server error')
      boomError.isBoom = true
      return boomError
    })
  })

  test('should throw Boom.badRequest when agreementId is undefined', async () => {
    Boom.badRequest.mockReturnValue(new Error('Agreement ID is required'))

    await expect(getAgreementDataById(undefined)).rejects.toThrow(
      'Agreement ID is required'
    )

    expect(Boom.badRequest).toHaveBeenCalledWith('Agreement ID is required')
  })

  test('should throw Boom.notFound when agreement group is not found', async () => {
    const agreementId = 'FPTT999999999'

    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockResolvedValue([])
    })

    await expect(getAgreementDataById(agreementId)).rejects.toThrow(
      `Agreement not found using search terms: ${JSON.stringify({
        agreementNumber: agreementId
      })}`
    )

    expect(agreementsModel.aggregate).toHaveBeenCalledWith([
      { $match: { agreementNumber: agreementId } },
      expectedLookup,
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: 1 }
    ])
    expect(versionsModel.findOne).not.toHaveBeenCalled()
  })

  test('should return agreement data when found', async () => {
    // Arrange
    const agreementId = 'FPTT123456789'

    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockResolvedValue([
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
      { $sort: { createdAt: -1, _id: -1 } },
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
    const agreementId = 'FPTT999999999'

    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockResolvedValue([])
    })

    // Act & Assert
    const expectedMessage = `Agreement not found using search terms: ${JSON.stringify(
      {
        agreementNumber: agreementId
      }
    )}`
    Boom.notFound.mockReturnValue(new Error(expectedMessage))

    await expect(getAgreementDataById(agreementId)).rejects.toThrow(
      expectedMessage
    )

    expect(Boom.notFound).toHaveBeenCalledWith(expectedMessage)
  })

  test('should handle missing logger gracefully', async () => {
    // Arrange
    const agreementId = 'FPTT123456789'

    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockResolvedValue([{ ...mockGroup, invoice: [] }])
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

describe('getAgreementDataBySbi', () => {
  const mockAgreement = {
    agreementNumber: 'FPTT123456789',
    agreementName: 'Test Agreement',
    signatureDate: '1/1/2024',
    identifiers: { sbi: '106284736' }
  }

  const mockGroup = {
    _id: '507f1f77bcf86cd799439011',
    agreementNumber: 'FPTT123456789',
    agreementName: 'Test Agreement',
    sbi: '106284736'
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
    vi.clearAllMocks()

    // Setup Boom mocks
    Boom.badRequest = vi.fn((message) => {
      const error = new Error(message)
      error.isBoom = true
      return error
    })
    Boom.notFound = vi.fn((message) => {
      const error = new Error(message)
      error.isBoom = true
      return error
    })
    Boom.internal = vi.fn((error) => {
      const boomError = new Error(error?.message || 'Internal server error')
      boomError.isBoom = true
      return boomError
    })
  })

  test('should throw Boom.badRequest when sbi is undefined getAgreementDataBySbi', async () => {
    Boom.badRequest.mockReturnValue(new Error('SBI is required'))

    await expect(getAgreementDataBySbi(undefined)).rejects.toThrow(
      'SBI is required'
    )

    expect(Boom.badRequest).toHaveBeenCalledWith('SBI is required')
  })

  test('should throw Boom.notFound when agreement group is not found getAgreementDataBySbi', async () => {
    const sbi = '106284736'

    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockResolvedValue([])
    })

    await expect(getAgreementDataBySbi(sbi)).rejects.toThrow(
      `Agreement not found using search terms: ${JSON.stringify({
        sbi
      })}`
    )

    expect(agreementsModel.aggregate).toHaveBeenCalledWith([
      { $match: { sbi } },
      expectedLookup,
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: 1 }
    ])
    expect(versionsModel.findOne).not.toHaveBeenCalled()
  })

  test('should return agreement data when found getAgreementDataBySbi', async () => {
    // Arrange
    const sbi = '106284736'

    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockResolvedValue([
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
    const result = await getAgreementDataBySbi(sbi)

    // Assert
    expect(agreementsModel.aggregate).toHaveBeenCalledWith([
      { $match: { sbi } }, // if you match a nested path, use { 'identifiers.sbi': sbi }
      expectedLookup,
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: 1 }
    ])

    expect(versionsModel.findOne).toHaveBeenCalledWith({
      agreement: mockGroup._id
    })

    expect(result.identifiers.sbi).toBe(sbi) // value check
    expect(typeof result.identifiers.sbi).toBe('string') // type check (guards against numeric sbi)

    expect(result).toEqual({
      ...mockAgreement,
      agreementNumber: mockGroup.agreementNumber,
      identifiers: { sbi: mockGroup.sbi },
      invoice: [{ test: 'invoice' }],
      version: 1
    })
  })

  test('should throw Boom.notFound when agreement is not found getAgreementDataBySbi', async () => {
    // Arrange
    const sbi = '106284736'

    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockResolvedValue([])
    })

    // Act & Assert
    const expectedMessage = `Agreement not found using search terms: ${JSON.stringify(
      {
        sbi
      }
    )}`
    Boom.notFound.mockReturnValue(new Error(expectedMessage))

    await expect(getAgreementDataBySbi(sbi)).rejects.toThrow(expectedMessage)

    expect(Boom.notFound).toHaveBeenCalledWith(expectedMessage)
  })

  test('should handle missing logger gracefully getAgreementDataBySbi', async () => {
    // Arrange
    const sbi = '106284736'

    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockResolvedValue([{ ...mockGroup, invoice: [] }])
    })

    versionsModel.findOne.mockReturnValue({
      sort: () => ({
        lean: () => Promise.resolve({ ...mockAgreement })
      })
    })

    // Act
    const result = await getAgreementDataBySbi(sbi)

    // Assert
    expect(result).toEqual({
      ...mockAgreement,
      identifiers: { sbi: mockGroup.sbi },
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
    vi.clearAllMocks()

    // Setup Boom mocks
    Boom.internal = vi.fn((error) => {
      const boomError = new Error(error?.message || 'Internal server error')
      boomError.isBoom = true
      return boomError
    })
  })

  test('should return true when agreement exists', async () => {
    // Arrange
    const searchTerms = { notificationMessageId: 'test-message-id' }
    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockResolvedValue([{ id: 'existing-agreement' }])
    })

    // Act
    const result = await doesAgreementExist(searchTerms)

    // Assert
    expect(agreementsModel.aggregate).toHaveBeenCalledWith([
      { $match: searchTerms },
      mockLookup,
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: 1 }
    ])
    expect(result).toBe(true)
  })

  test('should return false when agreement does not exist', async () => {
    // Arrange
    const searchTerms = { notificationMessageId: 'non-existent-message-id' }
    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockResolvedValue([])
    })

    // Act
    const result = await doesAgreementExist(searchTerms)

    // Assert
    expect(agreementsModel.aggregate).toHaveBeenCalledWith([
      { $match: searchTerms },
      mockLookup,
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: 1 }
    ])
    expect(result).toBe(false)
  })

  test('should handle database errors gracefully', async () => {
    // Arrange
    const searchTerms = { notificationMessageId: 'test-message-id' }
    const mockError = new Error('Database connection error')
    const boomError = new Error('Database connection error')
    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn((callback) => {
        return Promise.reject(callback(mockError))
      })
    })

    // Act & Assert
    Boom.internal.mockReturnValue(boomError)

    await expect(doesAgreementExist(searchTerms)).rejects.toThrow(
      'Database connection error'
    )

    expect(Boom.internal).toHaveBeenCalledWith(mockError)
  })

  test('should throw Boom.internal when aggregate throws', async () => {
    // Arrange
    const Boom = (await import('@hapi/boom')).default
    const searchTerms = { notificationMessageId: 'boom-test-id' }
    const mockError = new Error('Boom error')
    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockImplementation((cb) => {
        throw cb(mockError)
      })
    })

    // Act & Assert
    const boomError = new Error('Boom error')
    boomError.isBoom = true
    Boom.internal.mockReturnValue(boomError)

    await expect(doesAgreementExist(searchTerms)).rejects.toThrow('Boom error')

    expect(Boom.internal).toHaveBeenCalled()
  })

  test('should work with different search terms', async () => {
    // Arrange
    const searchTerms = { agreementNumber: 'FPTT123456789' }
    agreementsModel.aggregate.mockReturnValue({
      catch: vi.fn().mockResolvedValue([{ id: 'existing-agreement' }])
    })

    // Act
    const result = await doesAgreementExist(searchTerms)

    // Assert
    expect(agreementsModel.aggregate).toHaveBeenCalledWith([
      { $match: searchTerms },
      mockLookup,
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: 1 }
    ])
    expect(result).toBe(true)
  })
})
