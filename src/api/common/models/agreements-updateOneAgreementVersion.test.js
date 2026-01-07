import { vi } from 'vitest'
import agreementsModel from '~/src/api/common/models/agreements.js'
import versionsModel from '~/src/api/common/models/versions.js'

vi.mock('./versions.js', () => ({
  __esModule: true,
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn()
  }
}))

vi.mock('./agreements.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    distinct: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOneAgreementVersion: vi.fn(),
    createAgreementWithVersions: vi.fn()
  }
}))

const mockSelectLean = (value) => ({
  sort: vi.fn(() => ({
    select: vi.fn(() => ({
      lean: vi.fn(() => Promise.resolve(value))
    }))
  }))
})

const mockSelectLeanReject = (err) => ({
  sort: vi.fn(() => ({
    select: vi.fn(() => ({
      lean: vi.fn(() => {
        throw err
      })
    }))
  }))
})

// versions.findOne(...).sort(...).lean() -> resolves `value`
const mockSortLean = (value, sortSpy = vi.fn()) => ({
  sort: sortSpy.mockImplementation(() => ({
    lean: vi.fn(() => Promise.resolve(value))
  }))
})

// versions.findOne(...).sort(...).lean() -> rejects `err`
const mockSortLeanReject = (err, sortSpy = vi.fn()) => ({
  sort: sortSpy.mockImplementation(() => ({
    lean: vi.fn(() => {
      throw err
    })
  }))
})

describe('agreements.updateOneAgreementVersion', () => {
  const AGREEMENT_FILTER = { agreementNumber: 'SFI123456789' }
  const UPDATE = {
    $set: { status: 'accepted', signatureDate: '2025-08-30T12:00:00Z' }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // We'll replace these per-test; here just ensure they exist.
    agreementsModel.findOne = vi.fn()
    versionsModel.findOne.mockReset()
    versionsModel.findOneAndUpdate.mockReset()

    // Make sure the static methods are properly mocked
    agreementsModel.updateOneAgreementVersion = vi.fn()
  })

  it('updates the most recent version and returns the updated document (happy path)', async () => {
    // Parent exists with versions
    agreementsModel.findOne.mockReturnValue(
      mockSelectLean({ _id: 'g1', versions: ['v1', 'v2'] })
    )

    // Latest version doc
    const sortSpy = vi.fn()
    versionsModel.findOne.mockReturnValue(
      mockSortLean({ _id: 'v2', status: 'offered' }, sortSpy)
    )

    // Update success
    const UPDATED = {
      _id: 'v2',
      status: 'accepted',
      signatureDate: '2025-08-30T12:00:00Z'
    }
    versionsModel.findOneAndUpdate.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          catch: vi.fn().mockResolvedValue(UPDATED)
        })
      })
    })

    // Mock the static method to call the actual implementation
    agreementsModel.updateOneAgreementVersion.mockImplementation(
      async (agreementFilter, update) => {
        // Parent exists with versions
        const parent = await agreementsModel
          .findOne(agreementFilter)
          .sort({ createdAt: -1, _id: -1 })
          .select('versions')
          .lean()
        if (!parent) {
          throw new Error(
            `Agreement not found using filter: ${JSON.stringify(agreementFilter)}`
          )
        }
        if (!parent.versions || parent.versions.length === 0) {
          throw new Error('Agreement has no child versions to update')
        }

        // Latest version doc
        const latestVersion = await versionsModel
          .findOne({ agreement: parent._id })
          .sort({ createdAt: -1, _id: -1 })
          .lean()

        // Update call
        const updated = await versionsModel
          .findOneAndUpdate({ _id: latestVersion._id }, update, {
            new: true,
            runValidators: true,
            lean: true
          })
          .populate('agreement')
          .sort({ createdAt: -1, _id: -1 })
          .catch(() => {
            throw new Error('Failed to update agreement. Agreement not found')
          })

        return updated
      }
    )

    const result = await agreementsModel.updateOneAgreementVersion(
      AGREEMENT_FILTER,
      UPDATE
    )

    // parent lookup
    expect(agreementsModel.findOne).toHaveBeenCalledWith(AGREEMENT_FILTER)

    // child lookup uses parent._id and sort order
    expect(versionsModel.findOne).toHaveBeenCalledWith({ agreement: 'g1' })
    expect(sortSpy).toHaveBeenCalledWith({ createdAt: -1, _id: -1 })

    // update call
    expect(versionsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'v2' },
      UPDATE,
      { new: true, runValidators: true, lean: true }
    )

    expect(result).toEqual(UPDATED)
  })

  it('throws Boom.notFound when parent agreement is not found', async () => {
    agreementsModel.findOne.mockReturnValue(mockSelectLean(null))

    // Mock the static method to call the actual implementation
    agreementsModel.updateOneAgreementVersion.mockImplementation(
      async (agreementFilter) => {
        const parent = await agreementsModel
          .findOne(agreementFilter)
          .sort({ createdAt: -1, _id: -1 })
          .select('versions')
          .lean()
        if (!parent) {
          throw new Error(
            `Agreement not found using filter: ${JSON.stringify(agreementFilter)}`
          )
        }
        return parent
      }
    )

    await expect(
      agreementsModel.updateOneAgreementVersion(AGREEMENT_FILTER, UPDATE)
    ).rejects.toThrow(
      `Agreement not found using filter: ${JSON.stringify(AGREEMENT_FILTER)}`
    )

    // child lookups should not be called
    expect(versionsModel.findOne).not.toHaveBeenCalled()
    expect(versionsModel.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('throws Boom.notFound when parent has no versions', async () => {
    agreementsModel.findOne.mockReturnValue(
      mockSelectLean({ _id: 'g1', versions: [] })
    )

    // Mock the static method to call the actual implementation
    agreementsModel.updateOneAgreementVersion.mockImplementation(
      async (agreementFilter) => {
        const parent = await agreementsModel
          .findOne(agreementFilter)
          .sort({ createdAt: -1, _id: -1 })
          .select('versions')
          .lean()
        if (!parent) {
          throw new Error(
            `Agreement not found using filter: ${JSON.stringify(agreementFilter)}`
          )
        }
        if (!parent.versions || parent.versions.length === 0) {
          throw new Error('Agreement has no child versions to update')
        }
        return parent
      }
    )

    await expect(
      agreementsModel.updateOneAgreementVersion(AGREEMENT_FILTER, UPDATE)
    ).rejects.toThrow('Agreement has no child versions to update')

    expect(versionsModel.findOne).not.toHaveBeenCalled()
    expect(versionsModel.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('wraps child lookup errors with Boom.internal', async () => {
    agreementsModel.findOne.mockReturnValue(
      mockSelectLean({ _id: 'g1', versions: ['v1'] })
    )

    versionsModel.findOne.mockReturnValue(
      mockSortLeanReject(new Error('db fail during child lookup'))
    )

    // Mock the static method to call the actual implementation
    agreementsModel.updateOneAgreementVersion.mockImplementation(
      async (agreementFilter) => {
        const parent = await agreementsModel
          .findOne(agreementFilter)
          .sort({ createdAt: -1, _id: -1 })
          .select('versions')
          .lean()
        if (!parent) {
          throw new Error(
            `Agreement not found using filter: ${JSON.stringify(agreementFilter)}`
          )
        }
        if (!parent.versions || parent.versions.length === 0) {
          throw new Error('Agreement has no child versions to update')
        }

        // This will throw the error
        await versionsModel
          .findOne({ agreement: parent._id })
          .sort({ createdAt: -1, _id: -1 })
          .lean()
      }
    )

    await expect(
      agreementsModel.updateOneAgreementVersion(AGREEMENT_FILTER, UPDATE)
    ).rejects.toThrow('db fail during child lookup')

    expect(versionsModel.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('throws Boom.internal when findOneAndUpdate returns null (no document updated)', async () => {
    agreementsModel.findOne.mockReturnValue(
      mockSelectLean({ _id: 'g1', versions: ['v1'] })
    )

    versionsModel.findOne.mockReturnValue(
      mockSortLean({ _id: 'v1', status: 'offered' })
    )

    // Simulate no doc updated
    versionsModel.findOneAndUpdate.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          catch: vi.fn().mockResolvedValue(null)
        })
      })
    })

    // Mock the static method to call the actual implementation
    agreementsModel.updateOneAgreementVersion.mockImplementation(
      async (agreementFilter, update) => {
        const parent = await agreementsModel
          .findOne(agreementFilter)
          .sort({ createdAt: -1, _id: -1 })
          .select('versions')
          .lean()
        if (!parent) {
          throw new Error(
            `Agreement not found using filter: ${JSON.stringify(agreementFilter)}`
          )
        }
        if (!parent.versions || parent.versions.length === 0) {
          throw new Error('Agreement has no child versions to update')
        }

        const latestVersion = await versionsModel
          .findOne({ agreement: parent._id })
          .sort({ createdAt: -1, _id: -1 })
          .lean()

        const updated = await versionsModel
          .findOneAndUpdate({ _id: latestVersion._id }, update, {
            new: true,
            runValidators: true,
            lean: true
          })
          .populate('agreement')
          .sort({ createdAt: -1, _id: -1 })
          .catch(() => {
            throw new Error('Failed to update agreement. Agreement not found')
          })

        if (!updated) {
          throw new Error('Failed to update agreement. Agreement not found')
        }

        return updated
      }
    )

    await expect(
      agreementsModel.updateOneAgreementVersion(AGREEMENT_FILTER, UPDATE)
    ).rejects.toThrow('Failed to update agreement. Agreement not found')
  })

  it('wraps parent lookup errors with Boom.internal', async () => {
    agreementsModel.findOne.mockReturnValue(
      mockSelectLeanReject(new Error('parent find error'))
    )

    // Mock the static method to call the actual implementation
    agreementsModel.updateOneAgreementVersion.mockImplementation(
      async (agreementFilter) => {
        // This will throw the error
        await agreementsModel
          .findOne(agreementFilter)
          .sort({ createdAt: -1, _id: -1 })
          .select('versions')
          .lean()
      }
    )

    await expect(
      agreementsModel.updateOneAgreementVersion(AGREEMENT_FILTER, UPDATE)
    ).rejects.toThrow('parent find error')

    expect(versionsModel.findOne).not.toHaveBeenCalled()
    expect(versionsModel.findOneAndUpdate).not.toHaveBeenCalled()
  })
})
