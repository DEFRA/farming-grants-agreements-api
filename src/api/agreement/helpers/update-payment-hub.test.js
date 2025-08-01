import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import { updatePaymentHub } from './update-payment-hub.js'
import { getAgreementData } from './get-agreement-data.js'
import { createInvoice } from './invoice/create-invoice.js'
import { updateInvoice } from './invoice/update-invoice.js'
import { sendPaymentHubRequest } from '~/src/api/common/helpers/payment-hub/index.js'

// Mock all dependencies
jest.mock('./get-agreement-data.js')
jest.mock('./invoice/create-invoice.js')
jest.mock('./invoice/update-invoice.js')
jest.mock('~/src/api/common/helpers/payment-hub/index.js')
jest.mock('@hapi/boom')

describe('updatePaymentHub', () => {
  let mockServer, mockLogger, mockContext

  const mockAgreementData = {
    agreementNumber: 'SFI123456789',
    correlationId: 'test-correlation-id',
    frn: '1234567890',
    sbi: '106284736',
    payments: {
      activities: [
        {
          code: 'ACT001',
          description: 'Test Activity 1'
        },
        {
          code: 'ACT002',
          description: 'Test Activity 2'
        }
      ],
      yearlyBreakdown: {
        totalAgreementPayment: 5000,
        details: [
          {
            code: 'ACT001',
            totalPayment: 2000
          },
          {
            code: 'ACT002',
            totalPayment: 3000
          }
        ]
      }
    }
  }

  const mockInvoice = {
    invoiceNumber: 'INV-123456'
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockServer = { mock: 'server' }
    mockLogger = { mock: 'logger' }
    mockContext = { server: mockServer, logger: mockLogger }

    // Setup successful mocks by default
    getAgreementData.mockResolvedValue(mockAgreementData)
    createInvoice.mockResolvedValue(mockInvoice)
    updateInvoice.mockResolvedValue({ acknowledged: true })
    sendPaymentHubRequest.mockResolvedValue({ success: true })

    // Mock Date to ensure consistent testing
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2024)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Successful Payment Hub Updates', () => {
    it('should successfully send payment to hub with valid agreement', async () => {
      const agreementNumber = 'SFI123456789'

      const result = await updatePaymentHub(mockContext, agreementNumber)

      expect(getAgreementData).toHaveBeenCalledWith({ agreementNumber })
      expect(createInvoice).toHaveBeenCalledWith(
        agreementNumber,
        'test-correlation-id'
      )

      expect(updateInvoice).toHaveBeenCalledWith('INV-123456', {
        paymentHubRequest: expect.objectContaining({
          sourceSystem: 'AHWR',
          frn: '1234567890',
          sbi: '106284736',
          marketingYear: 2024,
          paymentRequestNumber: 1,
          correlationId: 'test-correlation-id',
          invoiceNumber: 'INV-123456',
          agreementNumber: 'SFI123456789',
          schedule: 'T4',
          dueDate: '2022-11-09',
          value: 5000,
          invoiceLines: [
            {
              value: 2000,
              description: 'Test Activity 1',
              schemeCode: 'ACT001'
            },
            {
              value: 3000,
              description: 'Test Activity 2',
              schemeCode: 'ACT002'
            }
          ]
        })
      })

      expect(sendPaymentHubRequest).toHaveBeenCalledWith(
        mockServer,
        mockLogger,
        expect.objectContaining({
          sourceSystem: 'AHWR',
          agreementNumber: 'SFI123456789'
        })
      )

      expect(result).toEqual({
        status: 'success',
        message: 'Payload sent to payment hub successfully'
      })
    })

    it('should handle agreement with no activities', async () => {
      const agreementWithNoActivities = {
        ...mockAgreementData,
        payments: {
          activities: [],
          yearlyBreakdown: {
            totalAgreementPayment: 0,
            details: []
          }
        }
      }

      getAgreementData.mockResolvedValue(agreementWithNoActivities)

      const result = await updatePaymentHub(mockContext, 'SFI123456789')

      expect(updateInvoice).toHaveBeenCalledWith('INV-123456', {
        paymentHubRequest: expect.objectContaining({
          value: 0,
          invoiceLines: []
        })
      })

      expect(result.status).toBe('success')
    })
  })

  describe('Error Handling', () => {
    it('should throw Boom error when agreement is not found', async () => {
      const notFoundError = new Error('Agreement not found')
      notFoundError.isBoom = true
      getAgreementData.mockRejectedValue(notFoundError)

      await expect(updatePaymentHub(mockContext, 'INVALID')).rejects.toThrow(
        'Agreement not found'
      )
    })

    it('should throw Boom.internal when createInvoice fails', async () => {
      const dbError = new Error('Database error')
      createInvoice.mockRejectedValue(dbError)
      Boom.internal.mockReturnValue(new Error('Internal server error'))

      await expect(
        updatePaymentHub(mockContext, 'SFI123456789')
      ).rejects.toThrow('Internal server error')

      expect(Boom.internal).toHaveBeenCalledWith(dbError)
    })

    it('should throw Boom.internal when updateInvoice fails', async () => {
      const updateError = new Error('Update failed')
      updateInvoice.mockRejectedValue(updateError)
      Boom.internal.mockReturnValue(new Error('Internal server error'))

      await expect(
        updatePaymentHub(mockContext, 'SFI123456789')
      ).rejects.toThrow('Internal server error')

      expect(Boom.internal).toHaveBeenCalledWith(updateError)
    })

    it('should throw Boom.internal when sendPaymentHubRequest fails', async () => {
      const hubError = new Error('Payment hub error')
      sendPaymentHubRequest.mockRejectedValue(hubError)
      Boom.internal.mockReturnValue(new Error('Internal server error'))

      await expect(
        updatePaymentHub(mockContext, 'SFI123456789')
      ).rejects.toThrow('Internal server error')

      expect(Boom.internal).toHaveBeenCalledWith(hubError)
    })

    it('should re-throw Boom errors without wrapping', async () => {
      const boomError = new Error('Boom error')
      boomError.isBoom = true
      sendPaymentHubRequest.mockRejectedValue(boomError)

      await expect(
        updatePaymentHub(mockContext, 'SFI123456789')
      ).rejects.toThrow('Boom error')

      expect(Boom.internal).not.toHaveBeenCalled()
    })
  })

  describe('Data Mapping', () => {
    it('should correctly map agreement data to payment hub request', async () => {
      await updatePaymentHub(mockContext, 'SFI123456789')

      const expectedPaymentRequest = {
        sourceSystem: 'AHWR',
        frn: '1234567890',
        sbi: '106284736',
        marketingYear: 2024,
        paymentRequestNumber: 1,
        correlationId: 'test-correlation-id',
        invoiceNumber: 'INV-123456',
        agreementNumber: 'SFI123456789',
        schedule: 'T4',
        dueDate: '2022-11-09',
        value: 5000,
        invoiceLines: [
          {
            value: 2000,
            description: 'Test Activity 1',
            schemeCode: 'ACT001'
          },
          {
            value: 3000,
            description: 'Test Activity 2',
            schemeCode: 'ACT002'
          }
        ]
      }

      expect(sendPaymentHubRequest).toHaveBeenCalledWith(
        mockServer,
        mockLogger,
        expectedPaymentRequest
      )
    })

    it('should handle missing activity details gracefully', async () => {
      const agreementWithMissingDetails = {
        ...mockAgreementData,
        payments: {
          activities: [{ code: 'ACT001', description: 'Test Activity' }],
          yearlyBreakdown: {
            totalAgreementPayment: 1000,
            details: [] // Missing details
          }
        }
      }

      getAgreementData.mockResolvedValue(agreementWithMissingDetails)

      // This should throw an error when trying to find the detail
      await expect(
        updatePaymentHub(mockContext, 'SFI123456789')
      ).rejects.toThrow()
    })
  })

  describe('Function Call Order', () => {
    it('should call functions in correct sequence', async () => {
      const callOrder = []

      getAgreementData.mockImplementation(() => {
        callOrder.push('getAgreementData')
        return Promise.resolve(mockAgreementData)
      })

      createInvoice.mockImplementation(() => {
        callOrder.push('createInvoice')
        return Promise.resolve(mockInvoice)
      })

      updateInvoice.mockImplementation(() => {
        callOrder.push('updateInvoice')
        return Promise.resolve({ acknowledged: true })
      })

      sendPaymentHubRequest.mockImplementation(() => {
        callOrder.push('sendPaymentHubRequest')
        return Promise.resolve({ success: true })
      })

      await updatePaymentHub(mockContext, 'SFI123456789')

      expect(callOrder).toEqual([
        'getAgreementData',
        'createInvoice',
        'updateInvoice',
        'sendPaymentHubRequest'
      ])
    })
  })
})
