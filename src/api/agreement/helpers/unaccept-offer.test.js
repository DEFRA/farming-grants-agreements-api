import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

// Import the module after setting up the mocks
import { unacceptOffer } from './unaccept-offer.js'

jest.mock('~/src/api/common/models/agreements.js', () => ({
  updateOneAgreementVersion: jest.fn()
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
    const updateResult = { modifiedCount: 1 }

    agreementsModel.updateOneAgreementVersion.mockResolvedValueOnce(
      updateResult
    )

    // Act
    const result = await unacceptOffer(agreementId)

    // Assert
    expect(agreementsModel.updateOneAgreementVersion).toHaveBeenCalledWith(
      { agreementNumber: agreementId },
      { $set: { status: 'offered', signatureDate: null } }
    )
    expect(result).toEqual({ success: true, updatedVersions: 1 })
  })

  test('should throw a boom error when updateOneAgreementVersion fails', async () => {
    // Arrange
    const agreementId = 'SFI123456789'

    agreementsModel.updateOneAgreementVersion.mockRejectedValueOnce(
      'Mock error'
    )

    // Act
    await expect(unacceptOffer(agreementId)).rejects.toThrow(
      Boom.internal('Mock error')
    )
  })
})
