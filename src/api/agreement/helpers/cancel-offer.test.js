import { vi } from 'vitest'
import Boom from '@hapi/boom'
import agreementModel from '#~/api/common/models/agreements.js'

// Import the module after setting up the mocks
import { cancelOffer } from './cancel-offer.js'

vi.mock('@hapi/boom')
vi.mock('#~/api/common/models/agreements.js', () => ({
  __esModule: true,
  default: {
    updateOneAgreementVersion: vi.fn()
  }
}))

describe('cancelOffer', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup Boom mocks
    Boom.internal = vi.fn((message) => {
      const boomError = new Error(message)
      boomError.isBoom = true
      return boomError
    })
  })

  test('should successfully cancel an offer', async () => {
    // Arrange
    const clientRef = 'client-ref-001'
    const agreementNumber = 'FPTT123456789'
    const mockResult = { modifiedCount: 1 }

    agreementModel.updateOneAgreementVersion.mockResolvedValueOnce(mockResult)

    // Act
    const result = await cancelOffer(clientRef, agreementNumber)

    // Assert
    expect(agreementModel.updateOneAgreementVersion).toHaveBeenCalledWith(
      {
        status: 'offered',
        clientRef,
        agreementNumber
      },
      {
        $set: {
          status: 'cancelled'
        }
      }
    )
    expect(result).toEqual(mockResult)
  })

  test('should throw Boom.internal when updateOneAgreementVersion fails', async () => {
    // Arrange
    const clientRef = 'client-ref-001'
    const agreementNumber = 'FPTT123456789'
    const error = new Error('Database error')

    agreementModel.updateOneAgreementVersion.mockRejectedValueOnce(error)
    Boom.internal.mockReturnValue(
      new Error(
        'Offer is not in the correct state to be cancelled or was not found'
      )
    )

    // Act & Assert
    await expect(cancelOffer(clientRef, agreementNumber)).rejects.toThrow(
      'Offer is not in the correct state to be cancelled or was not found'
    )

    expect(Boom.internal).toHaveBeenCalledWith(
      'Offer is not in the correct state to be cancelled or was not found',
      error
    )
  })

  test('should handle different clientRef values', async () => {
    // Arrange
    const clientRef = 'different-ref'
    const agreementNumber = 'FPTT987654321'
    const mockResult = { modifiedCount: 1 }

    agreementModel.updateOneAgreementVersion.mockResolvedValueOnce(mockResult)

    // Act
    const result = await cancelOffer(clientRef, agreementNumber)

    // Assert
    expect(agreementModel.updateOneAgreementVersion).toHaveBeenCalledWith(
      {
        status: 'offered',
        clientRef,
        agreementNumber
      },
      {
        $set: {
          status: 'cancelled'
        }
      }
    )
    expect(result).toEqual(mockResult)
  })
})
