import { randomUUID } from 'node:crypto'
import Boom from '@hapi/boom'
import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'

/**
 * Resolve the payment subdoc to persist on accept for an FPTT
 * (frps-private-beta) agreement.
 *
 * Calls Land Grants to recalculate the expected payments from the persisted
 * `application.parcel[]`, then merges existing per-payment `correlationId`s
 * by index so they are preserved across the accept transition.
 * @param {object} agreementData
 * @param {object} logger
 * @returns {Promise<object>} The payment subdoc to write back on accept.
 */
export const fpttResolveAcceptPayment = async (agreementData, logger) => {
  const expectedPayments = await calculatePaymentsBasedOnParcelsWithActions(
    agreementData.application.parcel,
    logger
  )

  if (!expectedPayments) {
    throw Boom.badImplementation('Failed to calculate expected payments')
  }

  // Preserve existing per-payment correlationIds by index; mint new ones otherwise.
  return {
    ...expectedPayments,
    payments: expectedPayments.payments.map((payment, index) => {
      const existingPayment = agreementData.payment?.payments?.[index]
      return {
        ...payment,
        correlationId: existingPayment?.correlationId || randomUUID()
      }
    })
  }
}
