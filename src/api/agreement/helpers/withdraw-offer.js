import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Withdraws an offer
 * @param {string} clientRef - The clientRef offer to update
 * @returns {Promise<object>} If the offer was successfully withdrawn
 */
async function withdrawOffer(clientRef) {
  const offer = await agreementsModel
    .updateOneAgreementVersion(
      {
        status: 'offered',
        clientRef
      },
      {
        $set: {
          status: 'withdrawn'
        }
      }
    )
    .catch((error) => {
      throw Boom.internal(error)
    })

  return offer
}

export { withdrawOffer }
