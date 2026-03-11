// Disable the mongoose mock for this test file to test the real implementation
import { vi } from 'vitest'

import agreementsModel from '#~/api/common/models/agreements.js'
import versionsModel from '#~/api/common/models/versions.js'

vi.unmock('mongoose')

describe('agreements.createAgreementWithVersions', () => {
  const AGREEMENT_BASE = {
    agreementNumber: 'FPTT123456789',
    clientRef: 'TEST-CLIENT-REF',
    sbi: '106284736',
    frn: '1234567890'
  }

  const VERSION_PAYLOADS = [
    {
      agreementNumber: 'FPTT123456789',
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
    const invalidAgreement = { sbi: 'y', frn: 'x' } // missing agreementNumber
    const promise1 = agreementsModel.createAgreementWithVersions({
      agreement: invalidAgreement,
      versions: VERSION_PAYLOADS
    })

    // Verify it returns a promise
    expect(promise1).toBeInstanceOf(Promise)
    await expect(promise1).rejects.toThrow(
      'agreement.agreementNumber is required'
    )

    // Test empty versions array - should throw asynchronously
    const promise2 = agreementsModel.createAgreementWithVersions({
      agreement: AGREEMENT_BASE,
      versions: []
    })
    // Verify it returns a promise
    expect(promise2).toBeInstanceOf(Promise)
    await expect(promise2).rejects.toThrow(
      'versions must be a non-empty array of agreement version payloads'
    )

    // Test non-array versions
    const promise3 = agreementsModel.createAgreementWithVersions({
      agreement: AGREEMENT_BASE,
      versions: 'not-an-array'
    })
    // Verify it returns a promise
    expect(promise3).toBeInstanceOf(Promise)
    await expect(promise3).rejects.toThrow(
      'versions must be a non-empty array of agreement version payloads'
    )
  })

  it('should return a promise and attempt real database operations', async () => {
    // Mock the database operations to simulate a connection error
    const findOneSpy = vi
      .spyOn(agreementsModel, 'findOne')
      .mockImplementation(() => {
        throw new Error('Database connection failed')
      })
    const createSpy = vi
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

    // Verify that findOne was called (create won't be called because findOne throws first)
    expect(findOneSpy).toHaveBeenCalled()
    // Note: create is not called because findOne throws synchronously before reaching create

    // Restore original methods
    findOneSpy.mockRestore()
    createSpy.mockRestore()
  })

  it('should attempt to find existing agreement with correct sort order', async () => {
    // Mock the chainable methods
    const mockFindOne = {
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null)
    }

    const findOneSpy = vi
      .spyOn(agreementsModel, 'findOne')
      .mockReturnValue(mockFindOne)

    // Mock create to avoid actual DB write and return a valid-looking mocked ID
    const mockId = '507f1f77bcf86cd799439011'
    const createSpy = vi
      .spyOn(agreementsModel, 'create')
      .mockResolvedValue({ _id: mockId })

    const versionsInsertSpy = vi
      .spyOn(versionsModel, 'insertMany')
      .mockResolvedValue([])

    // Spy on updateMany to avoid real DB calls
    const versionsUpdateManySpy = vi
      .spyOn(versionsModel, 'updateMany')
      .mockResolvedValue({})

    // Spy on updateOne and findById to avoid real DB calls and CastErrors
    const updateOneSpy = vi
      .spyOn(agreementsModel, 'updateOne')
      .mockResolvedValue({})

    const findByIdSpy = vi.spyOn(agreementsModel, 'findById').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: mockId })
    })

    await agreementsModel.createAgreementWithVersions({
      agreement: AGREEMENT_BASE,
      versions: VERSION_PAYLOADS
    })

    expect(findOneSpy).toHaveBeenCalledWith({ sbi: AGREEMENT_BASE.sbi })
    expect(mockFindOne.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 })

    // Restore mocks
    findOneSpy.mockRestore()
    createSpy.mockRestore()
    versionsInsertSpy.mockRestore()
    versionsUpdateManySpy.mockRestore()
    updateOneSpy.mockRestore()
    findByIdSpy.mockRestore()
  })
})

describe('agreements.findLatestAgreementVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should find latest agreement version successfully', async () => {
    const mockAgreement = {
      _id: 'agreement123',
      versions: ['version1', 'version2']
    }
    const mockVersion = {
      _id: 'version2',
      agreementNumber: 'FPTT123',
      status: 'offered',
      createdAt: new Date()
    }

    agreementsModel.findOne = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockAgreement)
        })
      })
    })

    versionsModel.findOne = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockVersion)
      })
    })

    const result = await agreementsModel.findLatestAgreementVersion({
      agreementNumber: 'FPTT123'
    })

    expect(result).toEqual(mockVersion)
    expect(agreementsModel.findOne).toHaveBeenCalledWith({
      agreementNumber: 'FPTT123'
    })
  })

  it('should throw 404 when agreement not found', async () => {
    agreementsModel.findOne = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null)
        })
      })
    })

    await expect(
      agreementsModel.findLatestAgreementVersion({ agreementNumber: 'FPTT123' })
    ).rejects.toThrow('Agreement not found using filter')

    expect(agreementsModel.findOne).toHaveBeenCalledWith({
      agreementNumber: 'FPTT123'
    })
  })

  it('should throw 404 when agreement has no versions', async () => {
    const mockAgreement = {
      _id: 'agreement123',
      versions: []
    }

    agreementsModel.findOne = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockAgreement)
        })
      })
    })

    await expect(
      agreementsModel.findLatestAgreementVersion({ agreementNumber: 'FPTT123' })
    ).rejects.toThrow('Agreement has no child versions to update')

    expect(agreementsModel.findOne).toHaveBeenCalledWith({
      agreementNumber: 'FPTT123'
    })
  })

  it('should throw 404 when agreement has null versions', async () => {
    const mockAgreement = {
      _id: 'agreement123',
      versions: null
    }

    agreementsModel.findOne = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockAgreement)
        })
      })
    })

    await expect(
      agreementsModel.findLatestAgreementVersion({ agreementNumber: 'FPTT123' })
    ).rejects.toThrow('Agreement has no child versions to update')

    expect(agreementsModel.findOne).toHaveBeenCalledWith({
      agreementNumber: 'FPTT123'
    })
  })

  it('should handle database errors', async () => {
    agreementsModel.findOne = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockRejectedValue(new Error('Database error'))
        })
      })
    })

    await expect(
      agreementsModel.findLatestAgreementVersion({ agreementNumber: 'FPTT123' })
    ).rejects.toThrow('Database error')

    expect(agreementsModel.findOne).toHaveBeenCalledWith({
      agreementNumber: 'FPTT123'
    })
  })
})

describe('agreements.updateOneAgreementVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update agreement version with agreementNumber filter', async () => {
    const mockLatestVersion = { _id: 'version123' }
    const mockUpdatedVersion = {
      _id: 'version123',
      status: 'accepted',
      agreement: { _id: 'agreement123' }
    }

    agreementsModel.findLatestAgreementVersion = vi
      .fn()
      .mockResolvedValue(mockLatestVersion)

    // Mock the complete chain with catch
    const mockChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockUpdatedVersion),
      catch: vi.fn().mockResolvedValue(mockUpdatedVersion)
    }

    versionsModel.findOneAndUpdate = vi.fn().mockReturnValue(mockChain)

    const result = await agreementsModel.updateOneAgreementVersion(
      { agreementNumber: 'FPTT123', sbi: '123456' },
      { status: 'accepted' }
    )

    expect(result).toEqual(mockUpdatedVersion)
    expect(agreementsModel.findLatestAgreementVersion).toHaveBeenCalledWith({
      agreementNumber: 'FPTT123'
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
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockUpdatedVersion),
      catch: vi.fn().mockResolvedValue(mockUpdatedVersion)
    }

    versionsModel.findOneAndUpdate = vi.fn().mockReturnValue(mockChain)

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
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
      catch: vi.fn().mockResolvedValue(null)
    }

    versionsModel.findOneAndUpdate = vi.fn().mockReturnValue(mockChain)

    await expect(
      agreementsModel.updateOneAgreementVersion(
        { _id: 'version123' },
        { status: 'accepted' }
      )
    ).rejects.toThrow('Failed to update agreement. Agreement not found')

    expect(versionsModel.findOneAndUpdate).toHaveBeenCalled()
  })

  it('should handle database errors', async () => {
    // Mock the complete chain with catch throwing error
    const mockChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockRejectedValue(new Error('Database error')),
      catch: vi.fn().mockRejectedValue(new Error('Database error'))
    }

    versionsModel.findOneAndUpdate = vi.fn().mockReturnValue(mockChain)

    await expect(
      agreementsModel.updateOneAgreementVersion(
        { _id: 'version123' },
        { status: 'accepted' }
      )
    ).rejects.toThrow('Database error')

    expect(versionsModel.findOneAndUpdate).toHaveBeenCalled()
  })
})
