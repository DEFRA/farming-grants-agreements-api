import { getAgreementDataById } from '#~/api/agreement/helpers/get-agreement-data.js'
import { generateInvoiceNumber } from '#~/api/agreement/helpers/invoice/generate-original-invoice-number.js'
import { getClaimId } from '#~/api/agreement/helpers/invoice/create-invoice.js'

function createPaymentInvoice(
  lineItem,
  parcelItems,
  description,
  agreementPayment,
  schemeCode,
  agreementLevelItems
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
    amountPence: lineItem.paymentPence.toString(),
    description,
    schemeCode
  }
}

/**
 * Maps agreement payments and their line items to the format expected by the payment hub.
 * @param {object} agreementData - The agreement data.
 * @returns {Array<object>} The mapped payments array.
 */
export const createPayments = (agreementData) => {
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
        agreementLevelItems
      )
    })

    return {
      dueDate: agreementPayment.paymentDate,
      totalAmountPence: agreementPayment.totalPaymentPence.toString(),
      status: 'pending',
      invoiceLines
    }
  })
}

/**
 * Creates an invoice payload from agreement data and mapped payments.
 * @param {string} agreementNumber - The agreement number.
 * @param {object} agreementData - The agreement data.
 * @param {Array<object>} payments - The mapped payments array.
 * @returns {Promise<object>} The invoice payload.
 */
export const createInvoice = async (
  agreementNumber,
  agreementData,
  payments
) => {
  const {
    payment: { agreementTotalPence, currency = 'GBP' },
    version,
    originalInvoiceNumber,
    identifiers: { sbi, frn } = {},
    claimId: agreementClaimId,
    correlationId
  } = agreementData

  const claimId = await getClaimId(agreementNumber, agreementData)

  const invoiceNumber =
    version === 1 && originalInvoiceNumber
      ? originalInvoiceNumber
      : generateInvoiceNumber(claimId, agreementData)

  return {
    sbi,
    frn,
    claimId: agreementClaimId,
    grants: [
      {
        sourceSystem: 'FPTT',
        deliveryBody: 'RP00',
        paymentRequestNumber: version,
        correlationId,
        invoiceNumber,
        originalInvoiceNumber,
        agreementNumber,
        totalAmountPence: agreementTotalPence,
        currency,
        marketingYear: new Date().getFullYear().toString(),
        accountCode: 'SOS710',
        fundCode: 'DRD10',
        payments
      }
    ]
  }
}

/**
 * Creates a grant payment object from agreement data.
 * @param {string} agreementNumber - The agreement number.
 * @param {object} [logger] - Optional logger.
 * @returns {Promise<object>} The grant payment object.
 */
export const createGrantPaymentFromAgreement = async (
  agreementNumber,
  logger
) => {
  const agreementData = await getAgreementDataById(agreementNumber)

  const payments = createPayments(agreementData)

  const {
    payment: { agreementTotalPence, currency = 'GBP' },
    version,
    originalInvoiceNumber,
    identifiers: { sbi, frn } = {},
    claimId: agreementClaimId,
    correlationId
  } = agreementData

  const claimId = await getClaimId(agreementNumber, agreementData)

  const invoiceNumber =
    version === 1 && originalInvoiceNumber
      ? originalInvoiceNumber
      : generateInvoiceNumber(claimId, agreementData)

  const grantPaymentsData = {
    sbi,
    frn,
    claimId: agreementClaimId,
    scheme: 'SFI',
    grants: [
      {
        sourceSystem: 'FPTT',
        deliveryBody: 'RP00',
        paymentRequestNumber: version,
        correlationId,
        invoiceNumber,
        originalInvoiceNumber,
        agreementNumber,
        totalAmountPence: agreementTotalPence.toString(),
        currency,
        marketingYear: new Date().getFullYear().toString(),
        payments
      }
    ]
  }

  logger?.info?.(
    `Passing the data to Grant Payment service ${JSON.stringify(grantPaymentsData, null, 2)}`
  )

  return grantPaymentsData
}
