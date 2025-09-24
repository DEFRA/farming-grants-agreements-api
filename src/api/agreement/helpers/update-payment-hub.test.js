import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import { updatePaymentHub } from './update-payment-hub.js'
import { getAgreementDataById } from './get-agreement-data.js'
import { createInvoice } from './invoice/create-invoice.js'
import { updateInvoice } from './invoice/update-invoice.js'
import { sendPaymentHubRequest } from '~/src/api/common/helpers/payment-hub/index.js'
import { config } from '~/src/config/index.js'

// Mock all dependencies
jest.mock('./get-agreement-data.js')
jest.mock('./invoice/create-invoice.js')
jest.mock('./invoice/update-invoice.js')
jest.mock('~/src/api/common/helpers/payment-hub/index.js')
jest.mock('@hapi/boom')
jest.mock('./get-agreement-data.js', () => ({
  getAgreementDataById: jest.fn()
}))
jest.mock('~/src/config/index.js', () => {
  const store = { 'featureFlags.isPaymentHubEnabled': false }
  return {
    config: {
      get: jest.fn((key) => store[key]),
      set: jest.fn((key, value) => {
        store[key] = value
      })
    }
  }
})

describe('updatePaymentHub', () => {
  let mockServer, mockLogger, mockContext

  const mockAgreementData = {
    agreementNumber: 'SFI123456789',
    correlationId: 'test-correlation-id',
    identifiers: {
      frn: '1234567890',
      sbi: '106284736'
    },
    frequency: 'Quarterly',
    payment: {
      parcelItems: {
        'parcel-item-1': {
          parcelId: 'PARCEL001',
          code: 'ACT001',
          description: 'ACT001: Test Activity 1',
          quantity: 10
        },
        'parcel-item-2': {
          parcelId: 'PARCEL002',
          code: 'ACT002',
          description: 'ACT002: Test Activity 2',
          quantity: 15
        }
      },
      agreementLevelItems: {},
      payments: [
        {
          paymentDate: '2022-11-09',
          lineItems: [
            {
              parcelItemId: 'parcel-item-1',
              paymentPence: 200000
            },
            {
              parcelItemId: 'parcel-item-2',
              paymentPence: 300000
            }
          ]
        }
      ],
      agreementTotalPence: 500000
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
    getAgreementDataById.mockResolvedValue(mockAgreementData)
    createInvoice.mockResolvedValue(mockInvoice)
    updateInvoice.mockResolvedValue({ acknowledged: true })
    sendPaymentHubRequest.mockResolvedValue({ success: true })

    // Mock Date to ensure consistent testing
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2024)

    config.set('featureFlags.isPaymentHubEnabled', true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Successful Payment Hub Updates', () => {
    it('should successfully send payment to hub with valid agreement', async () => {
      // await setPaymentHubConfig(true)
      const agreementNumber = 'SFI123456789'

      const result = await updatePaymentHub(mockContext, agreementNumber)

      expect(getAgreementDataById).toHaveBeenCalledWith(agreementNumber)
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
          value: 500000,
          invoiceLines: [
            [
              {
                value: 200000,
                description:
                  '2022-11-09: Parcel: PARCEL001: ACT001: Test Activity 1',
                schemeCode: 'ACT001'
              },
              {
                value: 300000,
                description:
                  '2022-11-09: Parcel: PARCEL002: ACT002: Test Activity 2',
                schemeCode: 'ACT002'
              }
            ]
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

    it('should not send payment hub request when payment hub toggle is disabled', async () => {
      config.set('featureFlags.isPaymentHubEnabled', false)
      const agreementNumber = 'SFI123456789'

      const result = await updatePaymentHub(mockContext, agreementNumber)

      expect(getAgreementDataById).toHaveBeenCalledWith(agreementNumber)
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
          value: 500000,
          invoiceLines: [
            [
              {
                value: 200000,
                description:
                  '2022-11-09: Parcel: PARCEL001: ACT001: Test Activity 1',
                schemeCode: 'ACT001'
              },
              {
                value: 300000,
                description:
                  '2022-11-09: Parcel: PARCEL002: ACT002: Test Activity 2',
                schemeCode: 'ACT002'
              }
            ]
          ]
        })
      })

      expect(sendPaymentHubRequest).not.toHaveBeenCalledWith(
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
        payment: {
          parcelItems: {},
          agreementLevelItems: {},
          payments: [
            {
              paymentDate: '2022-11-09',
              lineItems: []
            }
          ],
          agreementTotalPence: 0
        }
      }

      getAgreementDataById.mockResolvedValue(agreementWithNoActivities)

      const result = await updatePaymentHub(mockContext, 'SFI123456789')

      expect(updateInvoice).toHaveBeenCalledWith('INV-123456', {
        paymentHubRequest: expect.objectContaining({
          value: 0,
          invoiceLines: [[]]
        })
      })

      expect(result.status).toBe('success')
    })
  })

  describe('Error Handling', () => {
    it('should throw Boom error when agreement is not found', async () => {
      const notFoundError = new Error('Agreement not found')
      notFoundError.isBoom = true
      getAgreementDataById.mockRejectedValue(notFoundError)

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
    it('should map agreement level items and omit schedule for non-quarterly', async () => {
      const agreementWithAgreementLevelItem = {
        ...mockAgreementData,
        frequency: 'Annually',
        payment: {
          parcelItems: {},
          agreementLevelItems: {
            'agreement-level-1': {
              code: 'AL001',
              description: 'Annual management payment'
            }
          },
          payments: [
            {
              paymentDate: '2023-02-01',
              lineItems: [
                {
                  agreementLevelItemId: 'agreement-level-1',
                  paymentPence: 12345
                }
              ]
            }
          ],
          agreementTotalPence: 12345
        }
      }

      getAgreementDataById.mockResolvedValue(agreementWithAgreementLevelItem)

      await updatePaymentHub(mockContext, 'SFI123456789')

      expect(updateInvoice).toHaveBeenCalledWith('INV-123456', {
        paymentHubRequest: expect.objectContaining({
          schedule: undefined,
          dueDate: '2023-02-01',
          value: 12345,
          invoiceLines: [
            [
              {
                value: 12345,
                description:
                  '2023-02-01: One-off payment per agreement per year for Annual management payment',
                schemeCode: 'AL001'
              }
            ]
          ]
        })
      })
    })

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
        value: 500000,
        invoiceLines: [
          [
            {
              value: 200000,
              description:
                '2022-11-09: Parcel: PARCEL001: ACT001: Test Activity 1',
              schemeCode: 'ACT001'
            },
            {
              value: 300000,
              description:
                '2022-11-09: Parcel: PARCEL002: ACT002: Test Activity 2',
              schemeCode: 'ACT002'
            }
          ]
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
        payment: {
          parcelItems: {
            'parcel-item-1': {
              parcelId: 'PARCEL001',
              code: 'ACT001',
              description: 'ACT001: Test Activity',
              quantity: 10
            }
          },
          agreementLevelItems: {},
          payments: [
            {
              paymentDate: '2022-11-09',
              lineItems: [
                {
                  parcelItemId: 'parcel-item-1',
                  paymentPence: 100000
                }
              ]
            }
          ],
          agreementTotalPence: 100000
        }
      }

      getAgreementDataById.mockResolvedValue(agreementWithMissingDetails)

      const result = await updatePaymentHub(mockContext, 'SFI123456789')
      expect(result.status).toBe('success')
    })
  })

  describe('Function Call Order', () => {
    it('should call functions in correct sequence', async () => {
      const callOrder = []

      getAgreementDataById.mockImplementation(() => {
        callOrder.push('getAgreementDataById')
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
        'getAgreementDataById',
        'createInvoice',
        'updateInvoice',
        'sendPaymentHubRequest'
      ])
    })
  })
})
