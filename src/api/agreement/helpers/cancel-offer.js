import Boom from '@hapi/boom'
import agreementsModel from '#~/api/common/models/agreements.js'

/**
 * Cancels an offer
 * @param {string} clientRef - The clientRef offer to update
 * @param {string} agreementNumber - The agreement number of the offer to update
 * @returns {Promise<object>} If the offer was successfully cancelled
 */
const cancelOffer = (clientRef, agreementNumber) =>
  agreementsModel
    .updateOneAgreementVersion(
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
    )
    .catch((error) => {
      throw Boom.internal(
        'Offer is not in the correct state to be cancelled or was not found',
        error
      )
    })

export { cancelOffer }
