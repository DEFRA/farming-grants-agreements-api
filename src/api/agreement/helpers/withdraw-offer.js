import Boom from '@hapi/boom'
import { updateAgreementWithVersionViaGrant } from '#~/api/agreement/helpers/update-agreement-with-version-via-grant.js'

/**
 * Withdraws an offer
 * @param {string} clientRef - The clientRef offer to update
 * @param {string} agreementNumber - The agreement number of the offer to update
 * @returns {Promise<object>} If the offer was successfully withdrawn
 */
const withdrawOffer = (clientRef, agreementNumber) => {
  return updateAgreementWithVersionViaGrant(
    {
      status: 'offered',
      clientRef,
      agreementNumber
    },
    {
      $set: {
        status: 'withdrawn'
      }
    }
  ).catch((error) => {
    throw Boom.internal(
      'Offer is not in the correct state to be withdrawn or was not found',
      error
    )
  })
}

export { withdrawOffer }
