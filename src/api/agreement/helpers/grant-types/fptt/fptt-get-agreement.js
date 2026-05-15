import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'

/**
 * Get the payment subdoc for an FPTT (frps-private-beta) agreement on GET.
 *
 * For FPTT the agreement document is persisted **without** the payment subdoc
 * (`createAgreementWithVersions` calls `ignorePayments(versions)` by default).
 * The payment is materialised here by asking Land Grants to calculate it from
 * the persisted `application.parcel[].actions[]`.
 *
 * The call is gated by status to avoid re-pricing a finalised agreement:
 *  - `offered` — always recalculate (preview pricing for the farmer).
 *  - `withdrawn` / `cancelled` — only recalculate if no payment was ever persisted.
 *  - `accepted` / `terminated` — leave the persisted payment untouched.
 * @param {object} agreementData - The persisted agreement.
 * @param {object} logger
 * @returns {Promise<object|undefined>}
 */
export const fpttGetPayment = async (agreementData, logger) => {
  const { status, payment } = agreementData
  const shouldRecalculate =
    status === 'offered' ||
    ((status === 'withdrawn' || status === 'cancelled') && !payment)

  if (!shouldRecalculate) {
    return payment
  }

  const calculatedPayment = await calculatePaymentsBasedOnParcelsWithActions(
    agreementData.application.parcel,
    logger
  )
  logger.info(
    'Successfully called Land Grants service for payments calculation.'
  )
  return calculatedPayment
}
