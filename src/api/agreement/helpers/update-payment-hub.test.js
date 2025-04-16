import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { sendPaymentHubRequest } from '~/src/api/common/helpers/payment-hub/index.js'
import Boom from '@hapi/boom'

jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')
jest.mock('~/src/api/common/helpers/payment-hub/index.js')

describe('updatePaymentHub', () => {
  const logger = { info: jest.fn(), error: jest.fn() }
  const mockAgreementData = {
    agreementNumber: 'SFI123456789',
    sbi: 123456789
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getAgreementData.mockResolvedValue(mockAgreementData)
    sendPaymentHubRequest.mockResolvedValue({ status: 'success' })
  })

  test('should send payload to payment hub', async () => {
    const agreementId = 'SFI123456789'

    // Act
    const result = await updatePaymentHub(agreementId, logger)

    // Assert
    expect(sendPaymentHubRequest).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      status: 'success',
      message: 'Payload sent to payment hub successfully'
    })
  })

  test('should handle response not ok', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    sendPaymentHubRequest.mockRejectedValueOnce(
      new Error('Internal Server Error')
    )

    // Act & Assert
    await expect(updatePaymentHub(agreementId, logger)).rejects.toThrow(
      'Internal Server Error'
    )
  })

  test('should throw error when agreement data is not found', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    getAgreementData.mockRejectedValueOnce(Boom.notFound('Agreement not found'))

    // Act & Assert
    await expect(updatePaymentHub(agreementId, logger)).rejects.toThrow(
      'Agreement not found'
    )
  })

  test('should throw an error if fetch fails', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    sendPaymentHubRequest.mockRejectedValueOnce(new Error('Network error'))

    // Act & Assert
    await expect(updatePaymentHub(agreementId, logger)).rejects.toThrow(
      'Network error'
    )
  })
})
