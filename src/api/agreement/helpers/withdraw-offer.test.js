import { vi } from 'vitest'
import Boom from '@hapi/boom'
import agreementModel from '~/src/api/common/models/agreements.js'

// Import the module after setting up the mocks
import { withdrawOffer } from './withdraw-offer.js'

vi.mock('~/src/api/common/models/agreements.js', () => ({
  __esModule: true,
  default: {
    updateOneAgreementVersion: vi.fn()
  }
}))

describe('withdrawOffer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should successfully withdraw an offer', async () => {
    // Arrange
    const clientRef = 'client-ref-001'
    const agreementNumber = 'SFI123456789'
    const mockResult = { modifiedCount: 1 }

    agreementModel.updateOneAgreementVersion.mockResolvedValueOnce(mockResult)

    // Act
    const result = await withdrawOffer(clientRef, agreementNumber)

    // Assert
    expect(agreementModel.updateOneAgreementVersion).toHaveBeenCalledWith(
      {
        status: 'offered',
        clientRef,
        agreementNumber
      },
      {
        $set: {
          status: 'withdrawn'
        }
      }
    )
    expect(result).toEqual(mockResult)
  })

  test('should throw Boom.internal when updateOneAgreementVersion fails', async () => {
    // Arrange
    const clientRef = 'client-ref-001'
    const agreementNumber = 'SFI123456789'
    const error = new Error('Database error')

    agreementModel.updateOneAgreementVersion.mockRejectedValueOnce(error)

    // Act & Assert
    await expect(withdrawOffer(clientRef, agreementNumber)).rejects.toThrow(
      'Offer is not in the correct state to be withdrawn or was not found',
      Boom.internal(error)
    )
  })

  test('should handle different clientRef values', async () => {
    // Arrange
    const clientRef = 'different-ref'
    const agreementNumber = 'SFI987654321'
    const mockResult = { modifiedCount: 1 }

    agreementModel.updateOneAgreementVersion.mockResolvedValueOnce(mockResult)

    // Act
    const result = await withdrawOffer(clientRef, agreementNumber)

    // Assert
    expect(agreementModel.updateOneAgreementVersion).toHaveBeenCalledWith(
      {
        status: 'offered',
        clientRef,
        agreementNumber
      },
      {
        $set: {
          status: 'withdrawn'
        }
      }
    )
    expect(result).toEqual(mockResult)
  })
})
