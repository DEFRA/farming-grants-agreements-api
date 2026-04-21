import Boom from '@hapi/boom'
import { updateAgreementWithVersionViaGrant } from '#~/api/agreement/helpers/update-agreement-with-version-via-grant.js'

/**
 * Cancels an offer
 * @param {string} clientRef - The clientRef offer to update
 * @param {string} agreementNumber - The agreement number of the offer to update
 * @returns {Promise<object>} If the offer was successfully cancelled
 */
const cancelOffer = (clientRef, agreementNumber) => {
  return updateAgreementWithVersionViaGrant(
    {
      status: 'offered',
      clientRef,
      agreementNumber
    },
    {
      $set: {
        status: 'cancelled'
      }
    }
  ).catch((error) => {
    throw Boom.internal(
      'Offer is not in the correct state to be cancelled or was not found',
      error
    )
  })
}

export { cancelOffer }
