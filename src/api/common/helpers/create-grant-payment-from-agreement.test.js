import { vi, describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createGrantPaymentFromAgreement } from '#~/api/common/helpers/create-grant-payment-from-agreement.js'
import { generateInvoiceNumber } from '#~/api/agreement/helpers/invoice/generate-original-invoice-number.js'
import { getClaimId } from '#~/api/agreement/helpers/invoice/claim-id.js'

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn()
}))
vi.mock(
  '#~/api/agreement/helpers/invoice/generate-original-invoice-number.js',
  () => ({
    generateInvoiceNumber: vi.fn()
  })
)
vi.mock('#~/api/agreement/helpers/invoice/claim-id.js', () => ({
  getClaimId: vi.fn()
}))

describe('createGrantPaymentFromAgreement', () => {
  const agreementNumber = 'FPTT123456'
  const logger = {
    info: vi.fn()
  }

  const mockAgreementData = {
    agreementNumber: 'FPTT123456',
    version: 1,
    originalInvoiceNumber: 'ORIG-INV-123',
    claimId: 'R00000001',
    correlationId: '123e4567-e89b-12d3-a456-426614174000',
    identifiers: {
      sbi: 'SBI123',
      frn: 'FRN456'
    },
    payment: {
      currency: 'GBP',
      agreementTotalPence: 10000,
      payments: [
        {
          paymentDate: '2024-05-01',
          totalPaymentPence: 10000,
          correlationId: '324b1946-7c0f-4be0-8573-020e482c9a8d',
          lineItems: [
            {
              parcelItemId: 'PARCEL-1',
              paymentPence: 6000
            },
            {
              agreementLevelItemId: 'AGREEMENT-1',
              paymentPence: 4000
            }
          ]
        }
      ],
      parcelItems: {
        'PARCEL-1': {
          parcelId: 'P1',
          description: 'Parcel Item Description',
          code: 'CODE-P1'
        }
      },
      agreementLevelItems: {
        'AGREEMENT-1': {
          description: 'Agreement Level Description',
          code: 'CODE-A1'
        }
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(randomUUID).mockReturnValue('generated-payment-correlation-id')
    vi.mocked(getClaimId).mockResolvedValue('R00000001')
    vi.mocked(generateInvoiceNumber).mockReturnValue('R00000001-V001Q2')
  })

  it('should create grant payment from agreement', async () => {
    const result = await createGrantPaymentFromAgreement(
      mockAgreementData,
      logger
    )

    expect(getClaimId).toHaveBeenCalledWith(agreementNumber, mockAgreementData)
    expect(generateInvoiceNumber).toHaveBeenCalledWith('R00000001', 1)

    expect(result).toEqual({
      sbi: 'SBI123',
      frn: 'FRN456',
      claimId: 'R00000001',
      grants: [
        {
          sourceSystem: 'FPTT',
          scheme: 'SFI',
          deliveryBody: 'RP00',
          paymentRequestNumber: 1,
          correlationId: '123e4567-e89b-12d3-a456-426614174000',
          invoiceNumber: 'R00000001-V001Q2',
          originalInvoiceNumber: 'ORIG-INV-123',
          agreementNumber: 'FPTT123456',
          totalAmountPence: '10000',
          currency: 'GBP',
          marketingYear: new Date().getFullYear().toString(),
          payments: [
            {
              correlationId: '324b1946-7c0f-4be0-8573-020e482c9a8d',
              dueDate: '2024-05-01',
              totalAmountPence: '10000',
              status: 'pending',
              invoiceLines: [
                {
                  amountPence: '6000',
                  description:
                    '2024-05-01: Parcel: P1: Parcel Item Description',
                  schemeCode: 'CODE-P1'
                },
                {
                  amountPence: '4000',
                  description:
                    '2024-05-01: One-off payment per agreement per year for Agreement Level Description',
                  schemeCode: 'CODE-A1'
                }
              ]
            }
          ]
        }
      ]
    })
  })

  it('should use default currency GBP if not provided', async () => {
    const agreementDataNoCurrency = {
      ...mockAgreementData,
      payment: {
        ...mockAgreementData.payment,
        currency: undefined
      }
    }

    const result = await createGrantPaymentFromAgreement(
      agreementDataNoCurrency,
      logger
    )

    expect(result.grants[0].currency).toBe('GBP')
  })

  it('should handle missing logger gracefully', async () => {
    await expect(
      createGrantPaymentFromAgreement(mockAgreementData)
    ).resolves.toBeDefined()
  })

  it('should generate a payment correlationId when one is missing', async () => {
    const agreementDataWithoutPaymentCorrelationId = {
      ...mockAgreementData,
      payment: {
        ...mockAgreementData.payment,
        payments: [
          {
            paymentDate: '2024-05-01',
            totalPaymentPence: 10000,
            lineItems: [
              {
                parcelItemId: 'PARCEL-1',
                paymentPence: 6000
              }
            ]
          }
        ]
      }
    }

    const result = await createGrantPaymentFromAgreement(
      agreementDataWithoutPaymentCorrelationId,
      logger
    )

    expect(randomUUID).toHaveBeenCalledTimes(1)
    expect(result.grants[0].payments[0]).toEqual(
      expect.objectContaining({
        correlationId: 'generated-payment-correlation-id',
        invoiceLines: [
          {
            amountPence: '6000',
            description: '2024-05-01: Parcel: P1: Parcel Item Description',
            schemeCode: 'CODE-P1'
          }
        ]
      })
    )
  })

  it('should tolerate missing parcel and agreement-level item metadata', async () => {
    const agreementData = {
      ...mockAgreementData,
      payment: {
        ...mockAgreementData.payment,
        payments: [
          {
            paymentDate: '2024-05-01',
            totalPaymentPence: 10000,
            correlationId: 'known-correlation-id',
            lineItems: [
              {
                parcelItemId: 'UNKNOWN-PARCEL',
                paymentPence: 6000
              },
              {
                agreementLevelItemId: 'UNKNOWN-AGREEMENT',
                paymentPence: 4000
              }
            ]
          }
        ]
      }
    }

    const result = await createGrantPaymentFromAgreement(agreementData, logger)

    expect(result.grants[0].payments[0].invoiceLines).toEqual([
      {
        amountPence: '6000',
        description: '2024-05-01: Parcel: undefined: undefined',
        schemeCode: undefined
      },
      {
        amountPence: '4000',
        description:
          '2024-05-01: One-off payment per agreement per year for undefined',
        schemeCode: undefined
      }
    ])
  })
})
