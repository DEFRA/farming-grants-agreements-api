import { vi } from 'vitest'

import Boom from '@hapi/boom'
import { updatePaymentHub } from './update-payment-hub.js'
import { getAgreementDataById } from './get-agreement-data.js'
import { createInvoice } from './invoice/create-invoice.js'
import { updateInvoice } from './invoice/update-invoice.js'
import { sendPaymentHubRequest } from '~/src/api/common/helpers/payment-hub/index.js'
import { config } from '~/src/config/index.js'

// Mock all dependencies
vi.mock('./get-agreement-data.js')
vi.mock('./invoice/create-invoice.js')
vi.mock('./invoice/update-invoice.js')
vi.mock('~/src/api/common/helpers/payment-hub/index.js')
vi.mock('@hapi/boom')
vi.mock('./get-agreement-data.js', () => ({
  getAgreementDataById: vi.fn()
}))
vi.mock('~/src/config/index.js', () => {
  const store = {
    'featureFlags.isPaymentHubEnabled': false,
    'paymentHub.defaultSourceSystem': 'FPTT',
    'paymentHub.defaultLedger': 'AP'
  }
  return {
    config: {
      get: vi.fn((key) => store[key]),
      set: vi.fn((key, value) => {
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
    version: 1,
    identifiers: {
      sbi: '106284736',
      frn: '1234567890'
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
      agreementTotalPence: 500000,
      currency: 'GBP'
    }
  }

  const mockInvoice = {
    invoiceNumber: 'INV-123456'
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = { mock: 'server' }
    mockLogger = { mock: 'logger', warn: vi.fn() }
    mockContext = { server: mockServer, logger: mockLogger }

    // Setup successful mocks by default
    getAgreementDataById.mockResolvedValue(mockAgreementData)
    createInvoice.mockResolvedValue(mockInvoice)
    updateInvoice.mockResolvedValue({ acknowledged: true })
    sendPaymentHubRequest.mockResolvedValue({ success: true })

    // Mock Date to ensure consistent testing
    vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2024)

    config.set('featureFlags.isPaymentHubEnabled', true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Successful Payment Hub Updates', () => {
    it('should successfully send payment to hub with valid agreement', async () => {
      const agreementNumber = 'SFI123456789'

      const result = await updatePaymentHub(mockContext, agreementNumber)

      expect(getAgreementDataById).toHaveBeenCalledWith(agreementNumber)
      expect(createInvoice).toHaveBeenCalledWith(
        agreementNumber,
        'test-correlation-id'
      )

      expect(updateInvoice).toHaveBeenCalledWith('INV-123456', {
        paymentHubRequest: expect.objectContaining({
          sourceSystem: 'FPTT',
          sbi: '106284736',
          frn: '1234567890',
          marketingYear: 2024,
          paymentRequestNumber: 1,
          correlationId: 'test-correlation-id',
          invoiceNumber: 'INV-123456',
          agreementNumber: 'SFI123456789',
          schedule: 'T4',
          dueDate: '2022-11-09',
          value: 500000,
          currency: 'GBP',
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
          sourceSystem: 'FPTT',
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

      const result = await updatePaymentHub(
        mockContext,
        agreementNumber,
        mockContext.logger
      )

      expect(getAgreementDataById).toHaveBeenCalledWith(agreementNumber)
      expect(createInvoice).toHaveBeenCalledWith(
        agreementNumber,
        'test-correlation-id'
      )

      const paymentHubRequestData = {
        sourceSystem: 'FPTT',
        sbi: '106284736',
        frn: '1234567890',
        marketingYear: 2024,
        paymentRequestNumber: 1,
        correlationId: 'test-correlation-id',
        invoiceNumber: 'INV-123456',
        agreementNumber: 'SFI123456789',
        schedule: 'T4',
        dueDate: '2022-11-09',
        value: 500000,
        currency: 'GBP',
        ledger: 'AP',
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

      expect(updateInvoice).toHaveBeenCalledWith('INV-123456', {
        paymentHubRequest: expect.objectContaining(paymentHubRequestData)
      })

      expect(sendPaymentHubRequest).not.toHaveBeenCalledWith(
        mockServer,
        mockLogger,
        expect.objectContaining({
          sourceSystem: 'FPTT',
          agreementNumber: 'SFI123456789'
        })
      )

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `The PaymentHub feature flag is disabled. The request has not been sent to payment hub:${JSON.stringify(paymentHubRequestData, null, 2)}`
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
          agreementTotalPence: 0,
          currency: 'GBP'
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
        'Failed to setup payment schedule. Agreement not found'
      )

      expect(getAgreementDataById).toHaveBeenCalledWith('INVALID')
    })

    it('should throw Boom.internal when createInvoice fails', async () => {
      const dbError = new Error('Database error')
      createInvoice.mockRejectedValue(dbError)
      Boom.internal.mockReturnValue(new Error('Internal server error'))

      await expect(
        updatePaymentHub(mockContext, 'SFI123456789')
      ).rejects.toThrow('Internal server error')

      expect(dbError.message).toBe(
        'Failed to setup payment schedule. Database error'
      )
      expect(Boom.internal).toHaveBeenCalledWith(dbError)
    })

    it('should throw Boom.internal when updateInvoice fails', async () => {
      const updateError = new Error('Update failed')
      updateInvoice.mockRejectedValue(updateError)
      Boom.internal.mockReturnValue(new Error('Internal server error'))

      await expect(
        updatePaymentHub(mockContext, 'SFI123456789')
      ).rejects.toThrow('Internal server error')

      expect(updateError.message).toBe(
        'Failed to setup payment schedule. Update failed'
      )
      expect(Boom.internal).toHaveBeenCalledWith(updateError)
    })

    it('should throw Boom.internal when sendPaymentHubRequest fails', async () => {
      const hubError = new Error('Payment hub error')
      sendPaymentHubRequest.mockRejectedValue(hubError)
      Boom.internal.mockReturnValue(new Error('Internal server error'))

      await expect(
        updatePaymentHub(mockContext, 'SFI123456789')
      ).rejects.toThrow('Internal server error')

      expect(hubError.message).toBe(
        'Failed to setup payment schedule. Payment hub error'
      )
      expect(Boom.internal).toHaveBeenCalledWith(hubError)
    })

    it('should re-throw Boom errors without wrapping', async () => {
      config.set('featureFlags.isPaymentHubEnabled', true)
      const boomError = new Error('Boom error')
      boomError.isBoom = true
      sendPaymentHubRequest.mockRejectedValue(boomError)

      await expect(
        updatePaymentHub(mockContext, 'SFI123456789')
      ).rejects.toThrow('Failed to setup payment schedule. Boom error')

      expect(sendPaymentHubRequest).toHaveBeenCalled()
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
          agreementTotalPence: 12345,
          currency: 'GBP'
        }
      }

      getAgreementDataById.mockResolvedValue(agreementWithAgreementLevelItem)

      await updatePaymentHub(mockContext, 'SFI123456789')

      expect(updateInvoice).toHaveBeenCalledWith('INV-123456', {
        paymentHubRequest: expect.objectContaining({
          schedule: undefined,
          dueDate: '2023-02-01',
          value: 12345,
          currency: 'GBP',
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
        sourceSystem: 'FPTT',
        sbi: '106284736',
        frn: '1234567890',
        marketingYear: 2024,
        paymentRequestNumber: 1,
        correlationId: 'test-correlation-id',
        invoiceNumber: 'INV-123456',
        agreementNumber: 'SFI123456789',
        schedule: 'T4',
        dueDate: '2022-11-09',
        value: 500000,
        currency: 'GBP',
        ledger: 'AP',
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
          agreementTotalPence: 100000,
          currency: 'GBP'
        }
      }

      getAgreementDataById.mockResolvedValue(agreementWithMissingDetails)

      const result = await updatePaymentHub(mockContext, 'SFI123456789')
      expect(result.status).toBe('success')
    })

    it('should default currency to GBP when currency is null, empty string or undefined', async () => {
      const testCases = [
        { currency: null, description: 'null' },
        { currency: '', description: 'empty string' },
        { currency: undefined, description: 'undefined' }
      ]

      for (const testCase of testCases) {
        vi.clearAllMocks()

        const agreementWithMissingCurrency = {
          ...mockAgreementData,
          payment: {
            ...mockAgreementData.payment,
            currency: testCase.currency
          }
        }

        getAgreementDataById.mockResolvedValue(agreementWithMissingCurrency)

        await updatePaymentHub(mockContext, 'SFI123456789')

        expect(updateInvoice).toHaveBeenCalledWith('INV-123456', {
          paymentHubRequest: expect.objectContaining({
            currency: 'GBP'
          })
        })

        expect(sendPaymentHubRequest).toHaveBeenCalledWith(
          mockServer,
          mockLogger,
          expect.objectContaining({
            currency: 'GBP'
          })
        )
      }
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
