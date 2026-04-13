import Boom from '@hapi/boom'
import agreementsModel from '#~/api/common/models/agreements.js'

/**
 * Terminates an agreement
 * @param {string} clientRef - The clientRef of the agreement to update
 * @param {string} agreementNumber - The agreement number of the agreement to update
 * @returns {Promise<object>} If the agreement was successfully terminated
 */
const terminateAgreement = (clientRef, agreementNumber) =>
  agreementsModel
    .updateOneAgreementVersion(
      {
        status: 'accepted',
        clientRef,
        agreementNumber
      },
      {
        $set: {
          status: 'terminated'
        }
      }
    )
    .catch((error) => {
      throw Boom.internal(
        'Agreement is not in the correct state to be terminated or was not found',
        error
      )
    })

export { terminateAgreement }
