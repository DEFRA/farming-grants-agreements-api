import Boom from '@hapi/boom'
import { updateAgreementWithVersionViaGrant } from '#~/api/agreement/helpers/update-agreement-with-version-via-grant.js'

/**
 * Terminates an agreement
 * @param {string} clientRef - The clientRef of the agreement to update
 * @param {string} agreementNumber - The agreement number of the agreement to update
 * @returns {Promise<object>} If the agreement was successfully terminated
 */
const terminateAgreement = (clientRef, agreementNumber) => {
  return updateAgreementWithVersionViaGrant(
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
  ).catch((error) => {
    throw Boom.internal(
      'Agreement is not in the correct state to be terminated or was not found',
      error
    )
  })
}

export { terminateAgreement }
