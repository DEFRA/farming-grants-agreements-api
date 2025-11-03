import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import agreementModel from '~/src/api/common/models/agreements.js'
import versionsModel from '~/src/api/common/models/versions.js'

// Import the module after setting up the mocks
import { unacceptOffer } from './unaccept-offer.js'

jest.mock('~/src/api/common/models/agreements.js', () => ({
  findOne: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn()
}))

jest.mock('~/src/api/common/models/versions.js', () => ({
  updateMany: jest.fn()
}))

describe('unacceptOffer', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  beforeEach(() => {
    jest.setSystemTime(new Date('2024-01-01'))
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  test('should successfully unaccept an offer', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const mockAgreement = {
      _id: 'agreement1',
      agreementNumber: agreementId,
      versions: ['version1', 'version2']
    }
    const updateResult = { modifiedCount: 2 }

    agreementModel.exec.mockResolvedValueOnce(mockAgreement)
    versionsModel.updateMany.mockResolvedValueOnce(updateResult)

    // Act
    const result = await unacceptOffer(agreementId)

    // Assert
    expect(agreementModel.findOne).toHaveBeenCalledWith({
      agreementNumber: agreementId
    })
    expect(agreementModel.populate).toHaveBeenCalledWith('versions')
    expect(agreementModel.lean).toHaveBeenCalledTimes(1)
    expect(agreementModel.exec).toHaveBeenCalledTimes(1)
    expect(versionsModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: mockAgreement.versions } },
      {
        $set: {
          status: 'offered',
          signatureDate: null
        }
      }
    )
    expect(result).toEqual({ success: true, updatedVersions: 2 })
  })

  test('should not use sample ID in production environment', async () => {
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const agreementId = 'sample'
    const mockAgreement = {
      _id: 'someObjectId',
      agreementNumber: agreementId,
      versions: ['version1']
    }
    agreementModel.exec.mockResolvedValueOnce(mockAgreement)
    versionsModel.updateMany.mockResolvedValueOnce({
      matchedCount: 1,
      modifiedCount: 1
    })

    // Act
    const result = await unacceptOffer(agreementId)

    // Assert
    expect(agreementModel.findOne).toHaveBeenCalledWith({
      agreementNumber: agreementId
    })
    expect(versionsModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: mockAgreement.versions } },
      {
        $set: {
          status: 'offered',
          signatureDate: null
        }
      }
    )
    expect(result).toEqual({ success: true, updatedVersions: 1 })

    // Cleanup
    process.env.NODE_ENV = originalNodeEnv
  })

  test('should throw Boom.notFound when agreement is not found', async () => {
    // Arrange
    const agreementId = 'SFI999999999'
    agreementModel.exec.mockResolvedValueOnce(null)

    // Act & Assert
    await expect(unacceptOffer(agreementId)).rejects.toThrow(
      Boom.notFound(`Agreement not found with agreementNumber ${agreementId}`)
    )
  })

  test('should handle database errors when finding agreement', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const error = new Error('Database connection failed')
    agreementModel.exec.mockRejectedValueOnce(error)

    // Act & Assert
    await expect(unacceptOffer(agreementId)).rejects.toThrow(
      Boom.internal('Database connection failed')
    )
    expect(agreementModel.findOne).toHaveBeenCalledWith({
      agreementNumber: agreementId
    })
    expect(versionsModel.updateMany).not.toHaveBeenCalled()
  })

  test('should handle database errors when updating versions', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const mockAgreement = {
      _id: 'someObjectId',
      agreementNumber: agreementId,
      versions: ['version1']
    }
    agreementModel.exec.mockResolvedValueOnce(mockAgreement)
    const dbError = new Error('Failed to update versions')
    versionsModel.updateMany.mockRejectedValueOnce(dbError)

    // Act & Assert
    await expect(unacceptOffer(agreementId)).rejects.toThrow(
      Boom.internal('Failed to update versions: Failed to update versions')
    )
  })

  test('should throw Boom.notFound when no versions are found for agreement', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const mockAgreement = {
      _id: 'agreement1',
      agreementNumber: agreementId,
      versions: []
    }

    agreementModel.exec.mockResolvedValueOnce(mockAgreement)
    versionsModel.updateMany.mockResolvedValueOnce({
      matchedCount: 0,
      modifiedCount: 0
    })

    // Act & Assert
    await expect(unacceptOffer(agreementId)).rejects.toThrow(
      Boom.notFound(`No versions found for agreement ${agreementId}`)
    )
  })

  test('should handle Boom errors from version update', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const mockAgreement = {
      _id: 'agreement1',
      agreementNumber: agreementId,
      versions: ['version1', 'version2']
    }
    const errorMessage = 'Version update failed'
    agreementModel.exec.mockResolvedValueOnce(mockAgreement)
    versionsModel.updateMany.mockRejectedValueOnce(new Error(errorMessage))

    // Act & Assert
    await expect(unacceptOffer(agreementId)).rejects.toThrow(
      Boom.internal(`Failed to update versions: ${errorMessage}`)
    )
    expect(agreementModel.findOne).toHaveBeenCalledWith({
      agreementNumber: agreementId
    })
    expect(versionsModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: mockAgreement.versions } },
      {
        $set: {
          status: 'offered',
          signatureDate: null
        }
      }
    )
  })
})
