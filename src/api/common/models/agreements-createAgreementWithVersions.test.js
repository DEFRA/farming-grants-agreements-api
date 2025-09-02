import { jest } from '@jest/globals'
import agreementsModel from '~/src/api/common/models/agreements.js'
import versionsModel from '~/src/api/common/models/versions.js'

// Mock the child model first (versions)
jest.mock('./versions.js', () => {
  return {
    __esModule: true,
    default: {
      insertMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn()
    }
  }
})

describe('agreements.createAgreementWithVersions', () => {
  const AGREEMENT_BASE = {
    agreementNumber: 'SFI123456789',
    frn: '1234567890',
    sbi: '106284736',
    agreementName: 'Soil Protection Agreement',
    createdBy: 'system'
  }

  const VERSION_PAYLOADS = [
    {
      agreementNumber: 'SFI123456789',
      sbi: '106284736',
      status: 'offered',
      createdAt: new Date('2025-05-01')
    },
    {
      agreementNumber: 'SFI123456789',
      sbi: '106284736',
      status: 'accepted',
      createdAt: new Date('2025-05-02')
    }
  ]

  const makeFindByIdPopulateLean = (result) => ({
    populate: () => ({
      lean: () => Promise.resolve(result)
    })
  })

  // helpers for chainable mongoose-like mocks
  const mockSelectLean = (value) => ({
    select: () => ({ lean: () => Promise.resolve(value) })
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Default child mocks (can be overridden per test)
    versionsModel.insertMany.mockResolvedValue([
      { _id: 'v1', ...VERSION_PAYLOADS[0] },
      { _id: 'v2', ...VERSION_PAYLOADS[1] }
    ])
    versionsModel.updateMany.mockResolvedValue({
      matchedCount: 2,
      modifiedCount: 2
    })
    versionsModel.deleteMany.mockResolvedValue({ deletedCount: 0 })

    // final populated return

    // Default parent query mocks (overridden per test)
    // agreementsModel.findOne = jest.fn()
    agreementsModel.findOne = jest.fn(() => mockSelectLean(null))
    // agreementsModel.create  = jest.fn()
    agreementsModel.create = jest.fn().mockResolvedValue({ _id: 'g1' })
    agreementsModel.updateOne = jest
      .fn()
      .mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
    agreementsModel.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 })
    agreementsModel.findById = jest.fn()
  })

  it('creates a NEW parent when none exists and returns populated agreement', async () => {
    // No existing parent
    agreementsModel.findOne.mockReturnValue(mockSelectLean(null))

    // When creating, return new parent id
    agreementsModel.create.mockResolvedValue({ _id: 'g1' })

    // Final populated return from findById().populate().lean()
    const populatedReturn = {
      _id: 'g1',
      agreementNumber: AGREEMENT_BASE.agreementNumber,
      frn: AGREEMENT_BASE.frn,
      sbi: AGREEMENT_BASE.sbi,
      agreementName: AGREEMENT_BASE.agreementName,
      versions: [
        {
          _id: 'v1',
          agreementNumber: 'SFI123456789',
          sbi: '106284736',
          status: 'offered',
          createdAt: expect.anything()
        },
        {
          _id: 'v2',
          agreementNumber: 'SFI123456789',
          sbi: '106284736',
          status: 'accepted',
          createdAt: expect.anything()
        }
      ]
    }
    agreementsModel.findById.mockReturnValue(
      makeFindByIdPopulateLean(populatedReturn)
    )

    const result = await agreementsModel.createAgreementWithVersions({
      agreement: AGREEMENT_BASE,
      versions: VERSION_PAYLOADS
    })

    // Parent creation
    expect(agreementsModel.findOne).toHaveBeenCalledWith({
      frn: AGREEMENT_BASE.frn,
      sbi: AGREEMENT_BASE.sbi
    })
    expect(agreementsModel.create).toHaveBeenCalledWith({
      agreementNumber: AGREEMENT_BASE.agreementNumber,
      frn: AGREEMENT_BASE.frn,
      sbi: AGREEMENT_BASE.sbi,
      agreementName: AGREEMENT_BASE.agreementName,
      createdBy: AGREEMENT_BASE.createdBy,
      versions: []
    })

    // Child insert + back-link
    expect(versionsModel.insertMany).toHaveBeenCalledWith(VERSION_PAYLOADS)
    expect(versionsModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['v1', 'v2'] } },
      { $set: { agreement: 'g1' } }
    )

    // Parent append children ids
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { _id: 'g1' },
      { $push: { versions: { $each: ['v1', 'v2'] } } }
    )

    // Final populated
    expect(agreementsModel.findById).toHaveBeenCalledWith('g1')
    expect(result).toEqual(populatedReturn)
  })

  it('REUSES an existing parent and only appends NEW version ids (de-dup)', async () => {
    // Simulate existing parent with one version already there
    agreementsModel.findOne.mockReturnValue(
      mockSelectLean({ _id: 'g1', versions: ['v1'] })
    )

    // InsertMany returns one old id (v1) and one new (v2)
    versionsModel.insertMany.mockResolvedValue([
      { _id: 'v1', ...VERSION_PAYLOADS[0] }, // already exists in parent
      { _id: 'v2', ...VERSION_PAYLOADS[1] } // new
    ])

    const populatedReturn = {
      _id: 'g1',
      agreementNumber: AGREEMENT_BASE.agreementNumber,
      frn: AGREEMENT_BASE.frn,
      sbi: AGREEMENT_BASE.sbi,
      agreementName: AGREEMENT_BASE.agreementName,
      versions: [
        { _id: 'v1', status: 'offered' },
        { _id: 'v2', status: 'accepted' }
      ]
    }
    agreementsModel.findById.mockReturnValue(
      makeFindByIdPopulateLean(populatedReturn)
    )

    const result = await agreementsModel.createAgreementWithVersions({
      agreement: AGREEMENT_BASE,
      versions: VERSION_PAYLOADS
    })

    // Should NOT call create (reused)
    expect(agreementsModel.create).not.toHaveBeenCalled()

    // Back-link called for both inserted
    expect(versionsModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['v1', 'v2'] } },
      { $set: { agreement: 'g1' } }
    )

    // Append ONLY the new one v2
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { _id: 'g1' },
      { $push: { versions: { $each: ['v2'] } } }
    )

    expect(result).toEqual(populatedReturn)
  })

  it('throws when agreement payload is missing required fields', async () => {
    await expect(
      agreementsModel.createAgreementWithVersions({
        agreement: { /* missing agreementNumber/name */ frn: 'x', sbi: 'y' },
        versions: VERSION_PAYLOADS
      })
    ).rejects.toThrow(
      'agreement.agreementNumber and agreement.agreementName are required'
    )
  })

  it('throws when versions array is empty', async () => {
    await expect(
      agreementsModel.createAgreementWithVersions({
        agreement: AGREEMENT_BASE,
        versions: []
      })
    ).rejects.toThrow(
      'versions must be a non-empty array of agreement version payloads'
    )
  })

  it('performs best-effort cleanup if an error happens after creating a NEW parent and inserting versions', async () => {
    // No existing parent, so it will create one
    agreementsModel.findOne.mockReturnValue(mockSelectLean(null))
    agreementsModel.create.mockResolvedValue({ _id: 'g1' })

    // Insert child docs OK
    versionsModel.insertMany.mockResolvedValue([
      { _id: 'v1', ...VERSION_PAYLOADS[0] },
      { _id: 'v2', ...VERSION_PAYLOADS[1] }
    ])

    // Fail on back-link step to trigger cleanup
    versionsModel.updateMany.mockRejectedValue(new Error('link fail'))

    await expect(
      agreementsModel.createAgreementWithVersions({
        agreement: AGREEMENT_BASE,
        versions: VERSION_PAYLOADS
      })
    ).rejects.toThrow('link fail')

    // Parent (new) should be deleted
    expect(agreementsModel.deleteOne).toHaveBeenCalledWith({ _id: 'g1' })
    // Inserted children should be removed
    expect(versionsModel.deleteMany).toHaveBeenCalledWith({
      _id: { $in: ['v1', 'v2'] }
    })
  })
})
