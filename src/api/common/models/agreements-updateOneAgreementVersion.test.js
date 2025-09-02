import { jest } from '@jest/globals'
import agreementsModel from '~/src/api/common/models/agreements.js'
import versionsModel from '~/src/api/common/models/versions.js'

jest.mock('./versions.js', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn()
  }
}))

const mockSelectLean = (value) => ({
  select: jest.fn(() => ({
    lean: jest.fn(() => Promise.resolve(value))
  }))
})

const mockSelectLeanReject = (err) => ({
  select: jest.fn(() => ({
    lean: jest.fn(() => {
      throw err
    })
  }))
})

// versions.findOne(...).sort(...).lean() -> resolves `value`
const mockSortLean = (value, sortSpy = jest.fn()) => ({
  sort: sortSpy.mockImplementation(() => ({
    lean: jest.fn(() => Promise.resolve(value))
  }))
})

// versions.findOne(...).sort(...).lean() -> rejects `err`
const mockSortLeanReject = (err, sortSpy = jest.fn()) => ({
  sort: sortSpy.mockImplementation(() => ({
    lean: jest.fn(() => {
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
    jest.clearAllMocks()

    // We’ll replace these per-test; here just ensure they exist.
    agreementsModel.findOne = jest.fn()
    versionsModel.findOne.mockReset()
    versionsModel.findOneAndUpdate.mockReset()
  })

  it('updates the most recent version and returns the updated document (happy path)', async () => {
    // Parent exists with versions
    agreementsModel.findOne.mockReturnValue(
      mockSelectLean({ _id: 'g1', versions: ['v1', 'v2'] })
    )

    // Latest version doc
    const sortSpy = jest.fn()
    versionsModel.findOne.mockReturnValue(
      mockSortLean({ _id: 'v2', status: 'offered' }, sortSpy)
    )

    // Update success
    const UPDATED = {
      _id: 'v2',
      status: 'accepted',
      signatureDate: '2025-08-30T12:00:00Z'
    }
    versionsModel.findOneAndUpdate.mockResolvedValue(UPDATED)

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
    versionsModel.findOneAndUpdate.mockResolvedValue(null)

    await expect(
      agreementsModel.updateOneAgreementVersion(AGREEMENT_FILTER, UPDATE)
    ).rejects.toThrow('Failed to update the child agreement')
  })

  it('wraps parent lookup errors with Boom.internal', async () => {
    agreementsModel.findOne.mockReturnValue(
      mockSelectLeanReject(new Error('parent find error'))
    )

    await expect(
      agreementsModel.updateOneAgreementVersion(AGREEMENT_FILTER, UPDATE)
    ).rejects.toThrow('parent find error')

    expect(versionsModel.findOne).not.toHaveBeenCalled()
    expect(versionsModel.findOneAndUpdate).not.toHaveBeenCalled()
  })
})
