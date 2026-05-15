import Boom from '@hapi/boom'
import { calculateWmpPaymentDates } from '#~/api/adapter/land-grants-adapter.js'

/**
 * Build the payment subdoc to persist on accept for a WMP agreement.
 * @param {object} agreementData
 * @param {object} logger
 * @returns {Promise<object>} The payment subdoc to write back on accept.
 */
export const wmpBuildAcceptedPayment = async (agreementData, logger) => {
  const paymentDates = await calculateWmpPaymentDates(
    {
      parcelIds: (agreementData.application?.parcel ?? []).map(
        (parcel) => parcel.parcelId
      ),
      ...agreementData.schemeData
    },
    logger
  )

  if (!agreementData.payment || !paymentDates) {
    throw Boom.badImplementation('Failed to calculate WMP agreement dates')
  }

  return {
    ...agreementData.payment,
    agreementStartDate: paymentDates.agreementStartDate,
    agreementEndDate: paymentDates.agreementEndDate
  }
}
