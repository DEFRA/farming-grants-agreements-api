import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Withdraws an offer
 * @param {string} clientRef - The clientRef offer to update
 * @param {string} agreementNumber - The agreement number of the offer to update
 * @returns {Promise<object>} If the offer was successfully withdrawn
 */
async function withdrawOffer(clientRef, agreementNumber) {
  const offer = await agreementsModel
    .updateOneAgreementVersion(
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
    )
    .catch((error) => {
      throw Boom.internal(
        'Offer is not in the correct state to be withdrawn or was not found',
        error
      )
    })

  return offer
}

export { withdrawOffer }
