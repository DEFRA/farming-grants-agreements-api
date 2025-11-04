import Boom from '@hapi/boom'
import { getAgreementDataById } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { createInvoice } from '~/src/api/agreement/helpers/invoice/create-invoice.js'
import { updateInvoice } from '~/src/api/agreement/helpers/invoice/update-invoice.js'
import { sendPaymentHubRequest } from '~/src/api/common/helpers/payment-hub/index.js'
import { config } from '~/src/config/index.js'

/**
 * Sends a payload to the payments hub
 * @param {import('@hapi/hapi').Request<ReqRefDefaults>} request - hapi request object
 * @param {string} agreementNumber - Agreement number to update
 * @returns {Promise<*>} Result of the payment hub update
 * @throws {Error} If the agreement data is not found or if there is an error
 */
async function updatePaymentHub({ server, logger }, agreementNumber) {
  try {
    const agreementData = await getAgreementDataById(agreementNumber)
    const invoice = await createInvoice(
      agreementNumber,
      agreementData.correlationId
    )

    const marketingYear = new Date().getFullYear()

    const invoiceLines = agreementData.payment.payments.map((payment) =>
      payment.lineItems.map((line) => {
        let description, schemeCode
        if (line.parcelItemId) {
          const lineDetails =
            agreementData.payment.parcelItems[line.parcelItemId]
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
          value: line.paymentPence,
          description,
          schemeCode
        }
      })
    )

    // Construct the request payload based on the agreement data
    /** @type {PaymentHubRequest} */
    const paymentHubRequest = {
      sourceSystem: 'AHWR',
      frn: agreementData.identifiers.frn,
      sbi: agreementData.identifiers.sbi,
      marketingYear,
      paymentRequestNumber: 1,
      correlationId: agreementData.correlationId,
      invoiceNumber: invoice.invoiceNumber,
      agreementNumber: agreementData.agreementNumber,
      schedule: agreementData.frequency === 'Quarterly' ? 'T4' : undefined,
      dueDate: agreementData.payment.payments[0].paymentDate,
      value: agreementData.payment.agreementTotalPence,
      invoiceLines
    }

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

/** @import { PaymentHubRequest } from '~/src/api/common/types/payment-hub.d.js' */
