import { generateInvoiceNumber } from '#~/api/agreement/helpers/invoice/generate-original-invoice-number.js'
import { getClaimId } from '#~/api/agreement/helpers/invoice/claim-id.js'

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
const createPayments = (agreementData) => {
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

  const grantPaymentsData = {
    sbi,
    frn,
    claimId,
    scheme: 'SFI',
    grants: [
      {
        sourceSystem: 'FPTT',
        deliveryBody: 'RP00',
        paymentRequestNumber,
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
