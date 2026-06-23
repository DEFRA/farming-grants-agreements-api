import { generateInvoiceNumber } from '#~/api/agreement/helpers/invoice/generate-original-invoice-number.js'
import { getClaimId } from '#~/api/agreement/helpers/invoice/claim-id.js'
import { randomUUID } from 'node:crypto'

const PAYMENT_HUB_CONFIG = {
  accountCode: 'SOS710',
  deliveryBody: 'RP00',
  fesCode: 'FALS_FPTT',
  fundCode: 'DRD10',
  ledger: 'AP'
}

function createPaymentInvoice(
  lineItem,
  parcelItems,
  description,
  agreementPayment,
  schemeCode,
  agreementLevelItems,
  marketingYear
) {
  if (lineItem.parcelItemId) {
    const {
      parcelId,
      description: itemDescription,
      code
    } = parcelItems[lineItem.parcelItemId] || {}
    description = `${agreementPayment.paymentDate}: Parcel: ${parcelId}: ${itemDescription}`
    schemeCode = code
  }

  if (lineItem.agreementLevelItemId) {
    const { description: itemDescription, code } =
      agreementLevelItems[lineItem.agreementLevelItemId] || {}
    description = `${agreementPayment.paymentDate}: One-off payment per agreement per year for ${itemDescription}`
    schemeCode = code
  } else {
    // Default case to satisfy SonarQube
  }

  return {
    accountCode: PAYMENT_HUB_CONFIG.accountCode,
    amountPence: lineItem.paymentPence.toString(),
    deliveryBody: PAYMENT_HUB_CONFIG.deliveryBody,
    description,
    fundCode: PAYMENT_HUB_CONFIG.fundCode,
    marketingYear,
    schemeCode
  }
}

/**
 * Maps agreement payments and their line items to the format expected by the payment hub.
 * @param {object} agreementData - The agreement data.
 * @returns {Array<object>} The mapped payments array.
 */
const createPayments = (agreementData) => {
  const marketingYear = new Date().getFullYear().toString()
  const {
    payment: {
      payments: agreementPayments = [],
      parcelItems = {},
      agreementLevelItems = {}
    }
  } = agreementData

  return agreementPayments.map((agreementPayment) => {
    const invoiceLines = agreementPayment.lineItems.map((lineItem) => {
      let description, schemeCode

      return createPaymentInvoice(
        lineItem,
        parcelItems,
        description,
        agreementPayment,
        schemeCode,
        agreementLevelItems,
        marketingYear
      )
    })

    return {
      dueDate: agreementPayment.paymentDate,
      totalAmountPence: agreementPayment.totalPaymentPence.toString(),
      status: 'pending',
      invoiceLines,
      correlationId: agreementPayment.correlationId || randomUUID()
    }
  })
}

/**
 * Creates a grant payment object from agreement data.
 * @param {object} agreementData - The agreement data.
 * @param {object} [logger] - Optional logger.
 * @returns {Promise<object>} The grant payment object.
 */
export const createGrantPaymentFromAgreement = async (
  agreementData,
  logger
) => {
  const payments = createPayments(agreementData)

  const {
    agreementNumber,
    payment: { agreementTotalPence, currency = 'GBP' },
    originalInvoiceNumber,
    identifiers: { sbi, frn } = {},
    correlationId
  } = agreementData

  const claimId = await getClaimId(agreementNumber, agreementData)
  const paymentRequestNumber = 1
  const invoiceNumber = generateInvoiceNumber(claimId, paymentRequestNumber)
  const marketingYear = new Date().getFullYear().toString()

  const grantPaymentsData = {
    sbi,
    frn,
    claimId,
    scheme: 'SFI',
    grants: [
      {
        sourceSystem: 'FPTT',
        deliveryBody: PAYMENT_HUB_CONFIG.deliveryBody,
        fesCode: PAYMENT_HUB_CONFIG.fesCode,
        paymentRequestNumber,
        correlationId,
        invoiceNumber,
        ledger: PAYMENT_HUB_CONFIG.ledger,
        originalInvoiceNumber,
        agreementNumber,
        totalAmountPence: agreementTotalPence.toString(),
        currency,
        marketingYear,
        payments
      }
    ]
  }

  logger?.info?.(
    `Passing data to Grant Payment service for agreement: ${agreementNumber}, sbi: ${sbi} claimId: ${claimId}`
  )

  return grantPaymentsData
}
