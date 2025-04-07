import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Get agreement data for rendering templates
 * @returns {object} The agreement data
 * @param {string} agreementId - The agreement ID to fetch
 * @param {object} logger - Logger instance
 */
async function acceptAgreement(agreementId) {
  const agreement = await agreementsModel
    .updateOne(
      {
        agreementNumber: agreementId
      },
      {
        $set: {
          status: 'accepted',
          signatureDate: new Date().toISOString()
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

export { acceptAgreement }
