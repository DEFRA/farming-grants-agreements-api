import Boom from '@hapi/boom'

import { updateAgreementWithVersionViaGrant } from '#~/api/agreement/helpers/update-agreement-with-version-via-grant.js'

/**
 * Unaccepts an agreement and changes its status back to Offered
 * @param {string} agreementId - The agreement ID to update
 * @returns {Promise<object>} The updated agreement data
 */
async function unacceptOffer(agreementId) {
  const update = {
    $set: {
      status: 'offered',
      signatureDate: null
    }
  }

  await updateAgreementWithVersionViaGrant(
    { agreementNumber: agreementId },
    update
  ).catch((error) => {
    throw Boom.internal(error)
  })

  return { success: true, updatedVersions: 1 }
}

export { unacceptOffer }
