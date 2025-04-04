import Boom from '@hapi/boom'
import { config } from '~/src/config/index.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'

/**
 * Send the payload to the payment hub
 * @param {PaymentHubPayload} payload
 * @returns
 */
const sendPayloadToPaymentHub = async (payload, logger) =>
  await fetch(`${config.get('paymentHubUri')}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: payload
  })
    .then((response) => {
      if (!response.ok) {
        throw Boom.internal(`Failed to send payload: ${response.statusText}`)
      }
      // TODO - take this out before production
      logger.info(
        `Payload sent to payment hub: ${JSON.stringify(payload, null, 2)}`
      )
      return response.json()
    })
    .catch((error) => {
      throw Boom.internal(`Error sending payload: ${error.message}`)
    })

/**
 * Sends a payload to the payments hub
 * @param {string} agreementId
 * @param {*} logger
 * @returns {*}
 * @throws {Error} If the agreement data is not found or if there is an error
 */
async function updatePaymentHub(agreementId, logger) {
  try {
    const agreementData = await getAgreementData(agreementId)

    if (!agreementData) {
      throw Boom.notFound(`Agreement not found: ${agreementId}`)
    }

    // Construct the payload based on the agreement data
    /** @type {PaymentHubPayload} */
    const payload = {
      sourceSystem: 'AHWR',
      frn: 1234567890,
      sbi: 123456789,
      marketingYear: 2022,
      paymentRequestNumber: 1,
      paymentType: 1,
      correlationId: '123e4567-e89b-12d3-a456-426655440000',
      invoiceNumber: 'S1234567S1234567V001',
      agreementNumber: 'AHWR12345678',
      contractNumber: 'S1234567',
      currency: 'GBP',
      schedule: 'Q4',
      dueDate: '09/11/2022',
      value: 500,
      debtType: 'irr',
      recoveryDate: '09/11/2021',
      pillar: 'DA',
      originalInvoiceNumber: 'S1234567S1234567V001',
      originalSettlementDate: '09/11/2021',
      invoiceCorrectionReference: 'S1234567S1234567V001',
      trader: '123456A',
      vendor: '123456A',
      invoiceLines: [
        {
          value: 500,
          description: 'G00 - Gross value of claim',
          schemeCode: 'A1234',
          standardCode: 'ahwr-cows',
          accountCode: 'SOS123',
          deliveryBody: 'RP00',
          marketingYear: 2022,
          convergence: false,
          stateAid: false
        }
      ]
    }

    if (config.get('env') === 'development') {
      logger.info(
        `Payload to be sent to payment hub: ${JSON.stringify(payload, null, 2)}`
      )

      return {
        status: 'success',
        message: 'Payload sent to payment hub successfully'
      }
    }

    await sendPayloadToPaymentHub(payload, logger)

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

/** @import { PaymentHubPayload } from './update-payment-hub.d.js' */
