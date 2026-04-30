import { vi } from 'vitest'
import Boom from '@hapi/boom'

import { terminateAgreement } from './terminate-agreement.js'
import { updateAgreementWithVersionViaGrant } from '#~/api/agreement/helpers/update-agreement-with-version-via-grant.js'

vi.mock('@hapi/boom')
vi.mock('#~/api/common/models/agreements.js', () => ({
  __esModule: true,
  default: {
    updateOneAgreementVersion: vi.fn()
  }
}))
vi.mock('#~/api/agreement/helpers/update-agreement-with-version-via-grant.js')

describe('terminateAgreement', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    Boom.internal = vi.fn((message) => {
      const boomError = new Error(message)
      boomError.isBoom = true
      return boomError
    })
  })

  test('should successfully terminate an agreement', async () => {
    const clientRef = 'client-ref-001'
    const agreementNumber = 'FPTT123456789'
    const mockResult = { modifiedCount: 1 }

    updateAgreementWithVersionViaGrant.mockResolvedValueOnce(mockResult)

    const result = await terminateAgreement(clientRef, agreementNumber)

    expect(updateAgreementWithVersionViaGrant).toHaveBeenCalledWith(
      {
        status: 'accepted',
        clientRef,
        agreementNumber
      },
      {
        $set: {
          status: 'terminated'
        }
      }
    )
    expect(result).toEqual(mockResult)
  })

  test('should throw Boom.internal when updateAgreementWithVersionViaGrant fails', async () => {
    const clientRef = 'client-ref-001'
    const agreementNumber = 'FPTT123456789'
    const error = new Error('Database error')

    updateAgreementWithVersionViaGrant.mockRejectedValueOnce(error)
    Boom.internal.mockReturnValue(
      new Error(
        'Agreement is not in the correct state to be terminated or was not found'
      )
    )

    await expect(
      terminateAgreement(clientRef, agreementNumber)
    ).rejects.toThrow(
      'Agreement is not in the correct state to be terminated or was not found'
    )

    expect(Boom.internal).toHaveBeenCalledWith(
      'Agreement is not in the correct state to be terminated or was not found',
      error
    )
  })

  test('should handle different clientRef values', async () => {
    const clientRef = 'different-ref'
    const agreementNumber = 'FPTT987654321'
    const mockResult = { modifiedCount: 1 }

    updateAgreementWithVersionViaGrant.mockResolvedValueOnce(mockResult)

    const result = await terminateAgreement(clientRef, agreementNumber)

    expect(updateAgreementWithVersionViaGrant).toHaveBeenCalledWith(
      {
        status: 'accepted',
        clientRef,
        agreementNumber
      },
      {
        $set: {
          status: 'terminated'
        }
      }
    )
    expect(result).toEqual(mockResult)
  })
})
