import Boom from '@hapi/boom'
import { getAgreementDataById } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { createInvoice } from '~/src/api/agreement/helpers/invoice/create-invoice.js'
import { updateInvoice } from '~/src/api/agreement/helpers/invoice/update-invoice.js'
import { sendPaymentHubRequest } from '~/src/api/common/helpers/payment-hub/index.js'
import { formatPaymentDecimal } from '~/src/api/common/helpers/format-payment-decimal.js'
import {
  formatPaymentDate,
  validateOptionalPaymentDate
} from '~/src/api/common/helpers/format-payment-date.js'
import { config } from '~/src/config/index.js'

/**
 * Sends a payload to the payments hub
 * @param {import('@hapi/hapi').Request<ReqRefDefaults>} request - hapi request object
 * @param {string} agreementNumber - Agreement number to update
 * @returns {Promise<*>} Result of the payment hub update
 * @throws {Error} If the agreement data is not found or if there is an error
 */
const updatePaymentHub = async ({ server, logger }, agreementNumber) => {
  try {
    const agreementData = await getAgreementDataById(agreementNumber)
    const invoice = await createInvoice(agreementNumber, agreementData)

    const paymentHubRequest = buildPaymentHubRequest(
      agreementData,
      invoice.invoiceNumber
    )

    // update the invoice with the payment hub request
    await updateInvoice(invoice.invoiceNumber, {
      paymentHubRequest
    })

    if (config.get('featureFlags.isPaymentHubEnabled')) {
      await sendPaymentHubRequest(server, logger, paymentHubRequest)
    } else {
      logger.warn(
        `The PaymentHub feature flag is disabled. The request has not been sent to payment hub:${JSON.stringify(paymentHubRequest, null, 2)}`
      )
    }

    return {
      status: 'success',
      message: 'Payload sent to payment hub successfully',
      claimId: invoice.claimId
    }
  } catch (error) {
    error.message = `Failed to setup payment schedule. ${error.message}`
    if (error.isBoom) {
      throw error
    }

    throw Boom.internal(error)
  }
}

/** @import { PaymentHubRequest } from '~/src/api/common/types/payment-hub.d.js' */

const buildPaymentHubRequest = (agreementData, invoiceNumber) => {
  const marketingYear = new Date().getFullYear()
  const invoiceLines = buildInvoiceLines(agreementData)
  const { dueDate, recoveryDate, originalSettlementDate } =
    resolvePaymentDates(agreementData)

  return {
    sourceSystem: config.get('paymentHub.defaultSourceSystem'),
    sbi: agreementData.identifiers.sbi,
    frn: agreementData.identifiers.frn,
    marketingYear,
    paymentRequestNumber: agreementData.version,
    correlationId: agreementData.correlationId,
    invoiceNumber,
    agreementNumber: agreementData.agreementNumber,
    schedule:
      agreementData.payment.frequency === 'Quarterly' ? 'T4' : undefined,
    dueDate,
    recoveryDate,
    debtType: validateDebtType(''),
    remittanceDescription: validateRemittanceDescription(''),
    originalSettlementDate,
    value: formatPaymentDecimal(agreementData.payment.agreementTotalPence),
    currency: agreementData.payment.currency || 'GBP',
    ledger: config.get('paymentHub.defaultLedger'),
    deliveryBody: config.get('paymentHub.defaultDeliveryBody'),
    fesCode: config.get('paymentHub.defaultFesCode'),
    invoiceLines
  }
}

const resolvePaymentDates = (agreementData) => {
  const dueDate = formatPaymentDate(
    agreementData.payment.payments[0].paymentDate
  )
  const recoveryDate = agreementData.payment.recoveryDate ?? ''
  const originalSettlementDate =
    agreementData.payment.originalSettlementDate ?? ''

  validateOptionalPaymentDate(dueDate, 'dueDate')
  if (recoveryDate !== '') {
    validateOptionalPaymentDate(recoveryDate, 'recoveryDate')
  }
  if (originalSettlementDate !== '') {
    validateOptionalPaymentDate(
      originalSettlementDate,
      'originalSettlementDate'
    )
  }

  return { dueDate, recoveryDate, originalSettlementDate }
}

const DEBT_TYPE_MAX_LENGTH = 3

const validateDebtType = (debtType) => {
  if (debtType.length > DEBT_TYPE_MAX_LENGTH) {
    throw new Error(
      `value of ${debtType} must be no more than ${DEBT_TYPE_MAX_LENGTH} characters`
    )
  }
  return debtType
}

const REMITTANCE_DESCRIPTION_MAX_LENGTH = 60

const validateRemittanceDescription = (remittanceDescription) => {
  if (remittanceDescription.length > REMITTANCE_DESCRIPTION_MAX_LENGTH) {
    throw new Error(
      `value of ${remittanceDescription} must be no more than ${REMITTANCE_DESCRIPTION_MAX_LENGTH} characters`
    )
  }
  return remittanceDescription
}

const buildInvoiceLines = (agreementData) => {
  return agreementData.payment.payments.map((payment) =>
    payment.lineItems.map((line) => {
      let description, schemeCode
      if (line.parcelItemId) {
        const lineDetails = agreementData.payment.parcelItems[line.parcelItemId]
        description = `${payment.paymentDate}: Parcel: ${lineDetails.parcelId}: ${lineDetails.description}`
        schemeCode = lineDetails.code
      }
      if (line.agreementLevelItemId) {
        const lineDetails =
          agreementData.payment.agreementLevelItems[line.agreementLevelItemId]
        description = `${payment.paymentDate}: One-off payment per agreement per year for ${lineDetails.description}`
        schemeCode = lineDetails.code
      }

      return {
        value: formatPaymentDecimal(line.paymentPence),
        agreementNumber: agreementData.agreementNumber,
        description,
        schemeCode
      }
    })
  )
}

export { updatePaymentHub, validateDebtType, validateRemittanceDescription }
