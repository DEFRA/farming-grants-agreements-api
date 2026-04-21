import { vi } from 'vitest'
import agreementsModel from '../models/agreements.js'
import grantModel from '../models/grant.js'
import versionsModel from '../models/versions.js'
import { createGrantForExistingAgreements } from './create-grant-for-existing-agreements.js'
import Boom from '@hapi/boom'

vi.mock('../models/agreements.js', () => ({
  default: {
    find: vi.fn(),
    updateOne: vi.fn()
  }
}))

vi.mock('../models/grant.js', () => ({
  default: {
    create: vi.fn()
  }
}))

vi.mock('../models/versions.js', () => ({
  default: {
    findOne: vi.fn(),
    updateMany: vi.fn()
  }
}))

describe('createGrantForExistingAgreements', () => {
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn()
    }
    vi.clearAllMocks()
  })

  test('should skip migration if no agreements found', async () => {
    agreementsModel.find.mockResolvedValue([])

    await createGrantForExistingAgreements(mockLogger)

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Starting creation of grants for existing agreements...'
    )
    expect(agreementsModel.find).toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Found 0 agreements without grants.'
    )
    expect(grantModel.create).not.toHaveBeenCalled()
  })

  test('should create grants for agreements without them', async () => {
    const mockAgreements = [
      {
        _id: 'agreement-1',
        agreementNumber: 'AG-1',
        clientRef: 'C1',
        sbi: 'S1',
        frn: 'F1',
        versions: ['v1', 'v2']
      }
    ]
    const mockVersion = {
      _id: 'v2',
      code: 'CODE1',
      scheme: 'SCHEME1',
      claimId: 'CLAIM1'
    }
    const mockCreatedGrant = { _id: 'grant-1', name: 'SCHEME1' }

    agreementsModel.find.mockResolvedValue(mockAgreements)
    versionsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockVersion),
      catch: vi.fn().mockImplementation(() => Promise.resolve(mockVersion))
    })
    grantModel.create.mockResolvedValue(mockCreatedGrant)

    await createGrantForExistingAgreements(mockLogger)

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Found 1 agreements without grants.'
    )
    expect(grantModel.create).toHaveBeenCalledWith({
      code: 'CODE1',
      name: 'SCHEME1',
      agreementNumber: 'AG-1',
      clientRef: 'C1',
      sbi: 'S1',
      frn: 'F1',
      claimId: 'CLAIM1',
      versions: ['v1', 'v2']
    })
    expect(versionsModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['v1', 'v2'] } },
      { $set: { grant: 'grant-1', scheme: 'SCHEME1' } }
    )
    expect(agreementsModel.updateOne).toHaveBeenCalledWith(
      { _id: 'agreement-1' },
      { $push: { grants: 'grant-1' } }
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Created default grant SCHEME1 for agreement AG-1'
    )
  })

  test('should handle and throw errors', async () => {
    const error = new Error('Database connection failed')
    agreementsModel.find.mockRejectedValue(error)

    await expect(createGrantForExistingAgreements(mockLogger)).rejects.toThrow(
      error
    )
    expect(mockLogger.error).toHaveBeenCalledWith(
      error,
      'Error during migration of existing agreements to grants'
    )
  })

  test('should handle errors when fetching agreement version', async () => {
    const mockAgreements = [{ _id: 'agreement-1', versions: [] }]
    const error = new Error('Version fetch failed')

    agreementsModel.find.mockResolvedValue(mockAgreements)

    // The implementation has .catch((err) => { throw Boom.internal(err) })
    versionsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      catch: vi.fn().mockRejectedValue(Boom.internal(error))
    })

    await expect(createGrantForExistingAgreements(mockLogger)).rejects.toThrow()
    expect(mockLogger.error).toHaveBeenCalled()
  })
})
