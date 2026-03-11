import { vi } from 'vitest'

import Boom from '@hapi/boom'
import agreementsModel from '#~/api/common/models/agreements.js'

// Import the module after setting up the mocks
import { unacceptOffer } from './unaccept-offer.js'

vi.mock('@hapi/boom')
vi.mock('#~/api/common/models/agreements.js', () => ({
  __esModule: true,
  default: {
    updateOneAgreementVersion: vi.fn()
  }
}))

describe('unacceptOffer', () => {
  beforeAll(() => {
    vi.useFakeTimers()
  })

  beforeEach(() => {
    vi.setSystemTime(new Date('2024-01-01'))

    // Setup Boom mocks
    Boom.internal = vi.fn((error) => {
      const boomError = new Error(error)
      boomError.isBoom = true
      return boomError
    })
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  test('should successfully unaccept an offer', async () => {
    // Arrange
    const agreementId = 'FPTT123456789'
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
    const agreementId = 'FPTT123456789'
    const mockError = 'Mock error'

    agreementsModel.updateOneAgreementVersion.mockRejectedValueOnce(mockError)
    Boom.internal.mockReturnValue(new Error('Mock error'))

    // Act
    await expect(unacceptOffer(agreementId)).rejects.toThrow('Mock error')

    expect(Boom.internal).toHaveBeenCalledWith(mockError)
  })
})
