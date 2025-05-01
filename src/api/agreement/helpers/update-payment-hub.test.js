import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { sendPaymentHubRequest } from '~/src/api/common/helpers/payment-hub/index.js'
import { createInvoice } from '~/src/api/agreement/helpers/create-invoice.js'
import Boom from '@hapi/boom'

jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')
jest.mock('~/src/api/common/helpers/payment-hub/index.js')
jest.mock('~/src/api/agreement/helpers/create-invoice.js')

describe('updatePaymentHub', () => {
  const request = {
    server: jest.fn(),
    logger: { info: jest.fn(), error: jest.fn() }
  }
  const mockAgreementData = {
    agreementNumber: 'SFI123456789',
    sbi: 123456789,
    frn: 123456789,
    payments: {
      totalAnnualPayment: {
        totalAnnualPayment: 500
      }
    }
  }
  const mockInvoice = {
    agreementNumber: 'SFI123456789',
    invoiceNumber: 'FRPS123',
    correlationId: '123e4567-e89b-12d3-a456-426614174000'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getAgreementData.mockResolvedValue(mockAgreementData)
    sendPaymentHubRequest.mockResolvedValue({ status: 'success' })
    createInvoice.mockResolvedValue(mockInvoice)
  })

  test('should send payload to payment hub', async () => {
    const agreementId = 'SFI123456789'

    // Act
    const result = await updatePaymentHub(request, agreementId)

    // Assert
    expect(createInvoice).toHaveBeenCalledWith(agreementId)
    expect(sendPaymentHubRequest).toHaveBeenCalledTimes(1)
    expect(sendPaymentHubRequest).toHaveBeenCalledWith(
      request.server,
      request.logger,
      expect.objectContaining({
        agreementNumber: mockAgreementData.agreementNumber,
        invoiceNumber: mockInvoice.invoiceNumber,
        correlationId: mockInvoice.correlationId
      })
    )
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
    await expect(updatePaymentHub(request, agreementId)).rejects.toThrow(
      'Internal Server Error'
    )
  })

  test('should throw error when agreement data is not found', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    getAgreementData.mockRejectedValueOnce(Boom.notFound('Agreement not found'))

    // Act & Assert
    await expect(updatePaymentHub(request, agreementId)).rejects.toThrow(
      'Agreement not found'
    )
  })

  test('should throw an error if fetch fails', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    sendPaymentHubRequest.mockRejectedValueOnce(new Error('Network error'))

    // Act & Assert
    await expect(updatePaymentHub(request, agreementId)).rejects.toThrow(
      'Network error'
    )
  })

  test('should throw an error if invoice creation fails', async () => {
    // Arrange
    const agreementId = 'SFI123456789'
    const invoiceError = new Error('Failed to create invoice')
    createInvoice.mockRejectedValueOnce(invoiceError)

    // Act & Assert
    await expect(updatePaymentHub(request, agreementId)).rejects.toThrow(
      'Failed to create invoice'
    )
    expect(sendPaymentHubRequest).not.toHaveBeenCalled()
  })

  test('should include invoice data in the payment hub payload', async () => {
    // Arrange
    const agreementId = 'SFI123456789'

    // Act
    await updatePaymentHub(request, agreementId)

    // Assert
    expect(sendPaymentHubRequest).toHaveBeenCalledWith(
      request.server,
      request.logger,
      expect.objectContaining({
        agreementNumber: mockAgreementData.agreementNumber,
        invoiceNumber: mockInvoice.invoiceNumber,
        correlationId: mockInvoice.correlationId,
        sbi: mockAgreementData.sbi,
        frn: mockAgreementData.frn
      })
    )
  })
})
