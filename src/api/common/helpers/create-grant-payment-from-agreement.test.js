import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createGrantPaymentFromAgreement } from '#~/api/common/helpers/create-grant-payment-from-agreement.js'
import { getAgreementDataById } from '#~/api/agreement/helpers/get-agreement-data.js'
import { generateInvoiceNumber } from '#~/api/agreement/helpers/invoice/generate-original-invoice-number.js'
import { getClaimId } from '#~/api/agreement/helpers/invoice/claim-id.js'
import { config } from '#~/config/index.js'

vi.mock('#~/api/agreement/helpers/get-agreement-data.js', () => ({
  getAgreementDataById: vi.fn()
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
vi.mock('#~/config/index.js', () => ({
  config: { get: vi.fn() }
}))

describe('createGrantPaymentFromAgreement', () => {
  const agreementNumber = 'FPTT123456'
  const logger = {
    info: vi.fn()
  }

  const FIXED_NOW = new Date('2026-04-01T12:00:00.000Z')
  const TOMORROW = '2026-04-02'

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
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
    vi.clearAllMocks()
    vi.mocked(getAgreementDataById).mockResolvedValue(mockAgreementData)
    vi.mocked(getClaimId).mockResolvedValue('R00000001')
    vi.mocked(generateInvoiceNumber).mockReturnValue('R00000001-V001Q2')
    vi.mocked(config.get).mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should create grant payment from agreement with tomorrow as dueDate when test mode is enabled', async () => {
    const result = await createGrantPaymentFromAgreement(
      agreementNumber,
      logger
    )

    expect(getAgreementDataById).toHaveBeenCalledWith(agreementNumber)
    expect(getClaimId).toHaveBeenCalledWith(agreementNumber, mockAgreementData)
    expect(generateInvoiceNumber).toHaveBeenCalledWith(
      'R00000001',
      1,
      '2024-05-01'
    )

    expect(result).toEqual({
      sbi: 'SBI123',
      frn: 'FRN456',
      claimId: 'R00000001',
      scheme: 'SFI',
      grants: [
        {
          sourceSystem: 'FPTT',
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
              dueDate: TOMORROW,
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

  it('should use the original payment dueDate when test mode is disabled', async () => {
    vi.mocked(config.get).mockReturnValue(false)

    const result = await createGrantPaymentFromAgreement(
      agreementNumber,
      logger
    )

    expect(result.grants[0].payments[0].dueDate).toBe('2024-05-01')
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
})
