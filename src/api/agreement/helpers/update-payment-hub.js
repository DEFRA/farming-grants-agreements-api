import Boom from '@hapi/boom'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { createInvoice } from '~/src/api/agreement/helpers/create-invoice.js'
import { sendPaymentHubRequest } from '~/src/api/common/helpers/payment-hub/index.js'

/**
 * Sends a payload to the payments hub
 * @param {import('@hapi/hapi').Request<ReqRefDefaults>} request
 * @param {string} agreementId
 * @returns {*}
 * @throws {Error} If the agreement data is not found or if there is an error
 */
async function updatePaymentHub({ server, logger }, agreementId) {
  try {
    const agreementData = await getAgreementData(agreementId)
    const invoice = await createInvoice(
      agreementId,
      agreementData.correlationId
    )

    if (!agreementData) {
      throw Boom.notFound(`Agreement not found: ${agreementId}`)
    }

    const marketingYear = new Date().getFullYear()

    // Construct the payload based on the agreement data
    /** @type {PaymentHubPayload} */
    const payload = {
      sourceSystem: 'FRPS',
      frn: agreementData.frn,
      sbi: agreementData.sbi,
      marketingYear,
      paymentRequestNumber: 1,
      paymentType: 1,
      correlationId: agreementData.correlationId, // TODO - use the agreement correlation ID
      invoiceNumber: invoice.invoiceNumber,
      agreementNumber: agreementData.agreementNumber,
      contractNumber: 'S1234567',
      currency: 'GBP',
      schedule: 'T4',
      value: agreementData.payments.totalAnnualPayment.totalAnnualPayment,
      debtType: 'irr',
      pillar: 'DA',
      trader: '123456A',
      vendor: '123456A',
      invoiceLines: [
        {
          value: agreementData.payments.totalAnnualPayment.totalAnnualPayment,
          description: 'G00 - Gross value of agreement',
          schemeCode: 'A1234',
          standardCode: 'frps-cows',
          accountCode: 'SOS123',
          deliveryBody: 'RP00',
          marketingYear,
          convergence: false,
          stateAid: false
        }
      ]
    }

    await sendPaymentHubRequest(server, logger, payload)

    return {
      status: 'success',
      message: 'Payload sent to payment hub successfully'
    }
  } catch (error) {
    if (error.isBoom) {
      throw error
    }

    throw Boom.internal(error)
  }
}

export { updatePaymentHub }

/** @import { PaymentHubPayload } from '~/src/api/common/types/payment-hub.d.js' */
