import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  createGrantPaymentFromAgreement,
  createPayments,
  createInvoice
} from '#~/api/common/helpers/create-grant-payment-from-agreement.js'
import { getAgreementDataById } from '#~/api/agreement/helpers/get-agreement-data.js'
import { generateInvoiceNumber } from '#~/api/agreement/helpers/invoice/generate-original-invoice-number.js'
import { getClaimId } from '#~/api/agreement/helpers/invoice/create-invoice.js'

vi.mock('#~/api/agreement/helpers/get-agreement-data.js', () => ({
  getAgreementDataById: vi.fn()
}))
vi.mock(
  '#~/api/agreement/helpers/invoice/generate-original-invoice-number.js',
  () => ({
    generateInvoiceNumber: vi.fn()
  })
)
vi.mock('#~/api/agreement/helpers/invoice/create-invoice.js', () => ({
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
    claimId: 'CLAIM-789',
    correlationId: 'CORR-ID-001',
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
    vi.mocked(getAgreementDataById).mockResolvedValue(mockAgreementData)
    vi.mocked(getClaimId).mockResolvedValue('CLAIM-789')
    vi.mocked(generateInvoiceNumber).mockReturnValue('GEN-INV-456')
  })

  it('should create grant payment from agreement with version 1 and original invoice number', async () => {
    const result = await createGrantPaymentFromAgreement(
      agreementNumber,
      logger
    )

    expect(getAgreementDataById).toHaveBeenCalledWith(agreementNumber)
    expect(getClaimId).toHaveBeenCalledWith(agreementNumber, mockAgreementData)

    expect(result).toEqual({
      sbi: 'SBI123',
      frn: 'FRN456',
      claimId: 'CLAIM-789',
      grants: [
        {
          sourceSystem: 'FPTT',
          paymentRequestNumber: 1,
          correlationId: 'CORR-ID-001',
          invoiceNumber: 'ORIG-INV-123',
          originalInvoiceNumber: 'ORIG-INV-123',
          agreementNumber: 'FPTT123456',
          totalAmountPence: '10000',
          currency: 'GBP',
          marketingYear: new Date().getFullYear().toString(),
          accountCode: 'SOS710',
          fundCode: 'DRD10',
          payments: [
            {
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

  it('should generate invoice number if version is not 1', async () => {
    const agreementDataV2 = {
      ...mockAgreementData,
      version: 2
    }
    vi.mocked(getAgreementDataById).mockResolvedValue(agreementDataV2)

    const result = await createGrantPaymentFromAgreement(
      agreementNumber,
      logger
    )

    expect(generateInvoiceNumber).toHaveBeenCalledWith(
      'CLAIM-789',
      agreementDataV2
    )
    expect(result.grants[0].invoiceNumber).toBe('GEN-INV-456')
    expect(result.grants[0].paymentRequestNumber).toBe(2)
  })

  it('should generate invoice number if originalInvoiceNumber is missing even if version is 1', async () => {
    const agreementDataNoOrig = {
      ...mockAgreementData,
      originalInvoiceNumber: undefined
    }
    vi.mocked(getAgreementDataById).mockResolvedValue(agreementDataNoOrig)

    const result = await createGrantPaymentFromAgreement(
      agreementNumber,
      logger
    )

    expect(generateInvoiceNumber).toHaveBeenCalled()
    expect(result.grants[0].invoiceNumber).toBe('GEN-INV-456')
  })

  it('should use default currency GBP if not provided', async () => {
    const agreementDataNoCurrency = {
      ...mockAgreementData,
      payment: {
        ...mockAgreementData.payment,
        currency: undefined
      }
    }
    vi.mocked(getAgreementDataById).mockResolvedValue(agreementDataNoCurrency)

    const result = await createGrantPaymentFromAgreement(
      agreementNumber,
      logger
    )

    expect(result.grants[0].currency).toBe('GBP')
  })

  it('should handle missing logger gracefully', async () => {
    await expect(
      createGrantPaymentFromAgreement(agreementNumber)
    ).resolves.toBeDefined()
  })

  describe('createPayments', () => {
    it('should map agreement payments correctly', () => {
      const result = createPayments(mockAgreementData)
      expect(result).toEqual([
        {
          dueDate: '2024-05-01',
          totalAmountPence: '10000',
          status: 'pending',
          invoiceLines: [
            {
              amountPence: '6000',
              description: '2024-05-01: Parcel: P1: Parcel Item Description',
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
      ])
    })
  })

  describe('createInvoice', () => {
    it('should create invoice payload correctly', async () => {
      const payments = [
        {
          dueDate: '2024-05-01',
          totalAmountPence: 10000,
          status: 'pending',
          invoiceLines: []
        }
      ]
      const result = await createInvoice(
        agreementNumber,
        mockAgreementData,
        payments
      )

      expect(getClaimId).toHaveBeenCalledWith(
        agreementNumber,
        mockAgreementData
      )
      expect(result.grants[0].payments).toBe(payments)
      expect(result.sbi).toBe('SBI123')
    })
  })
})
