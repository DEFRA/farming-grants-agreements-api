// Disable the mongoose mock for this test file to test the real implementation
import { jest } from '@jest/globals'
import agreementsModel from '~/src/api/common/models/agreements.js'
import versionsModel from '~/src/api/common/models/versions.js'

jest.unmock('mongoose')

describe('agreements.createAgreementWithVersions', () => {
  const AGREEMENT_BASE = {
    agreementNumber: 'SFI123456789',
    clientRef: 'TEST-CLIENT-REF',
    sbi: '106284736',
    frn: '1234567890'
  }

  const VERSION_PAYLOADS = [
    {
      agreementNumber: 'SFI123456789',
      sbi: '106284736',
      status: 'offered',
      createdAt: new Date('2025-05-01')
    }
  ]

  it('should have static methods defined on the model', () => {
    expect(typeof agreementsModel.createAgreementWithVersions).toBe('function')
    expect(typeof agreementsModel.findLatestAgreementVersion).toBe('function')
    expect(typeof agreementsModel.updateOneAgreementVersion).toBe('function')
  })

  it('should validate input parameters and throw async errors', async () => {
    // Test missing agreementNumber - should throw asynchronously
    await expect(
      agreementsModel.createAgreementWithVersions({
        agreement: { sbi: 'y', frn: 'x' }, // missing agreementNumber
        versions: VERSION_PAYLOADS
      })
    ).rejects.toThrow('agreement.agreementNumber is required')

    // Test empty versions array - should throw asynchronously
    await expect(
      agreementsModel.createAgreementWithVersions({
        agreement: AGREEMENT_BASE,
        versions: []
      })
    ).rejects.toThrow(
      'versions must be a non-empty array of agreement version payloads'
    )

    // Test non-array versions
    await expect(
      agreementsModel.createAgreementWithVersions({
        agreement: AGREEMENT_BASE,
        versions: 'not-an-array'
      })
    ).rejects.toThrow(
      'versions must be a non-empty array of agreement version payloads'
    )
  })

  it('should return a promise and attempt real database operations', async () => {
    // Mock the database operations to simulate a connection error
    const findOneSpy = jest
      .spyOn(agreementsModel, 'findOne')
      .mockImplementation(() => {
        throw new Error('Database connection failed')
      })
    const createSpy = jest
      .spyOn(agreementsModel, 'create')
      .mockImplementation(() => {
        throw new Error('Database connection failed')
      })

    const result = agreementsModel.createAgreementWithVersions({
      agreement: AGREEMENT_BASE,
      versions: VERSION_PAYLOADS
    })

    // The method should return a promise
    expect(result).toBeInstanceOf(Promise)

    // The promise should be rejected with a database operation error
    // This confirms we're using the real implementation, not a mock
    await expect(result).rejects.toThrow('Database connection failed')

    // Restore original methods
    findOneSpy.mockRestore()
    createSpy.mockRestore()
  })
})

describe('agreements.findLatestAgreementVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should find latest agreement version successfully', async () => {
    const mockAgreement = {
      _id: 'agreement123',
      versions: ['version1', 'version2']
    }
    const mockVersion = {
      _id: 'version2',
      agreementNumber: 'SFI123',
      status: 'offered',
      createdAt: new Date()
    }

    agreementsModel.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockAgreement)
      })
    })

    versionsModel.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockVersion)
      })
    })

    const result = await agreementsModel.findLatestAgreementVersion({
      agreementNumber: 'SFI123'
    })

    expect(result).toEqual(mockVersion)
    expect(agreementsModel.findOne).toHaveBeenCalledWith({
      agreementNumber: 'SFI123'
    })
  })

  it('should throw 404 when agreement not found', async () => {
    agreementsModel.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })
    })

    await expect(
      agreementsModel.findLatestAgreementVersion({ agreementNumber: 'SFI123' })
    ).rejects.toThrow('Agreement not found using filter')
  })

  it('should throw 404 when agreement has no versions', async () => {
    const mockAgreement = {
      _id: 'agreement123',
      versions: []
    }

    agreementsModel.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockAgreement)
      })
    })

    await expect(
      agreementsModel.findLatestAgreementVersion({ agreementNumber: 'SFI123' })
    ).rejects.toThrow('Agreement has no child versions to update')
  })

  it('should throw 404 when agreement has null versions', async () => {
    const mockAgreement = {
      _id: 'agreement123',
      versions: null
    }

    agreementsModel.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockAgreement)
      })
    })

    await expect(
      agreementsModel.findLatestAgreementVersion({ agreementNumber: 'SFI123' })
    ).rejects.toThrow('Agreement has no child versions to update')
  })

  it('should handle database errors', async () => {
    agreementsModel.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Database error'))
      })
    })

    await expect(
      agreementsModel.findLatestAgreementVersion({ agreementNumber: 'SFI123' })
    ).rejects.toThrow('Database error')
  })
})

describe('agreements.updateOneAgreementVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should update agreement version with agreementNumber filter', async () => {
    const mockLatestVersion = { _id: 'version123' }
    const mockUpdatedVersion = {
      _id: 'version123',
      status: 'accepted',
      agreement: { _id: 'agreement123' }
    }

    agreementsModel.findLatestAgreementVersion = jest
      .fn()
      .mockResolvedValue(mockLatestVersion)

    // Mock the complete chain with catch
    const mockChain = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockUpdatedVersion),
      catch: jest.fn().mockResolvedValue(mockUpdatedVersion)
    }

    versionsModel.findOneAndUpdate = jest.fn().mockReturnValue(mockChain)

    const result = await agreementsModel.updateOneAgreementVersion(
      { agreementNumber: 'SFI123', sbi: '123456' },
      { status: 'accepted' }
    )

    expect(result).toEqual(mockUpdatedVersion)
    expect(agreementsModel.findLatestAgreementVersion).toHaveBeenCalledWith({
      agreementNumber: 'SFI123'
    })
    expect(versionsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'version123', sbi: '123456' },
      { status: 'accepted' },
      { new: true, runValidators: true, lean: true }
    )
  })

  it('should update agreement version with direct filter', async () => {
    const mockUpdatedVersion = {
      _id: 'version123',
      status: 'accepted',
      agreement: { _id: 'agreement123' }
    }

    // Mock the complete chain with catch
    const mockChain = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockUpdatedVersion),
      catch: jest.fn().mockResolvedValue(mockUpdatedVersion)
    }

    versionsModel.findOneAndUpdate = jest.fn().mockReturnValue(mockChain)

    const result = await agreementsModel.updateOneAgreementVersion(
      { _id: 'version123', sbi: '123456' },
      { status: 'accepted' }
    )

    expect(result).toEqual(mockUpdatedVersion)
    expect(versionsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'version123', sbi: '123456' },
      { status: 'accepted' },
      { new: true, runValidators: true, lean: true }
    )
  })

  it('should throw 404 when update fails', async () => {
    // Mock the complete chain with catch returning null
    const mockChain = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
      catch: jest.fn().mockResolvedValue(null)
    }

    versionsModel.findOneAndUpdate = jest.fn().mockReturnValue(mockChain)

    await expect(
      agreementsModel.updateOneAgreementVersion(
        { _id: 'version123' },
        { status: 'accepted' }
      )
    ).rejects.toThrow('Failed to update agreement. Agreement not found')
  })

  it('should handle database errors', async () => {
    // Mock the complete chain with catch throwing error
    const mockChain = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockRejectedValue(new Error('Database error')),
      catch: jest.fn().mockRejectedValue(new Error('Database error'))
    }

    versionsModel.findOneAndUpdate = jest.fn().mockReturnValue(mockChain)

    await expect(
      agreementsModel.updateOneAgreementVersion(
        { _id: 'version123' },
        { status: 'accepted' }
      )
    ).rejects.toThrow('Database error')
  })
})
