import Boom from '@hapi/boom'

import agreementsModel from '~/src/api/common/models/agreements.js'

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

  await agreementsModel
    .updateOneAgreementVersion({ agreementNumber: agreementId }, update)
    .catch((error) => {
      throw Boom.internal(error)
    })

  return { success: true, updatedVersions: 1 }
}

export { unacceptOffer }
