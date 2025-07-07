import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Unaccepts an agreement and changes it's status back to Offered
 * @returns {object} The agreement data
 * @param {string} agreementId - The agreement ID to fetch
 */
async function unacceptOffer(agreementId) {
  const agreement = await agreementsModel
    .updateOne(
      {
        agreementNumber: agreementId
      },
      {
        $set: {
          status: 'offered',
          signatureDate: null
        }
      }
    )
    .catch((error) => {
      throw Boom.internal(error)
    })

  if (!agreement) {
    throw Boom.notFound(`Agreement not found with ID ${agreementId}`)
  }

  return agreement
}

export { unacceptOffer }
