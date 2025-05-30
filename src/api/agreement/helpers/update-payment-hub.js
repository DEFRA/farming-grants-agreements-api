import Boom from '@hapi/boom'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { createInvoice } from '~/src/api/agreement/helpers/invoice/create-invoice.js'
import { updateInvoice } from '~/src/api/agreement/helpers/invoice/update-invoice.js'
import { sendPaymentHubRequest } from '~/src/api/common/helpers/payment-hub/index.js'

/**
 * Sends a payload to the payments hub
 * @param {import('@hapi/hapi').Request<ReqRefDefaults>} request
 * @param {string} agreementId
 * @returns {*}
 * @throws {Error} If the agreement data is not found or if there is an error
 */
async function updatePaymentHub({ server, logger }, agreementNumber) {
  try {
    const agreementData = await getAgreementData({
      agreementNumber
    })
    const invoice = await createInvoice(
      agreementNumber,
      agreementData.correlationId
    )

    if (!agreementData) {
      throw Boom.notFound(`Agreement not found: ${agreementNumber}`)
    }

    const marketingYear = new Date().getFullYear()

    const { activities, yearlyBreakdown } = agreementData.payments

    const invoiceLines = activities.map((activity) => ({
      value: yearlyBreakdown.details.find(
        (detail) => detail.code === activity.code
      ).totalPayment,
      description: activity.description,
      schemeCode: activity.code
    }))

    // Construct the request payload based on the agreement data
    /** @type {PaymentHubRequest} */
    const paymentHubRequest = {
      sourceSystem: 'AHWR',
      frn: agreementData.frn,
      sbi: agreementData.sbi,
      marketingYear,
      paymentRequestNumber: 1,
      correlationId: agreementData.correlationId,
      invoiceNumber: invoice.invoiceNumber,
      agreementNumber: agreementData.agreementNumber,
      schedule: 'T4',
      dueDate: '2022-11-09',
      value: yearlyBreakdown.totalAgreementPayment,
      invoiceLines
    }

    // update the invoice with the payment hub request
    await updateInvoice(invoice.invoiceNumber, {
      paymentHubRequest
    })

    // send the payment hub request
    await sendPaymentHubRequest(server, logger, paymentHubRequest)

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
