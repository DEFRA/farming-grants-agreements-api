import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Get agreement data for rendering templates
 * @param {string} agreementId - The agreement ID to fetch
 * @returns {Promise<object>} The agreement data
 */
const getAgreementData = async (agreementId) => {
  const agreement = await agreementsModel
    .findOne({ agreementNumber: agreementId })
    .lean()
    .catch((error) => {
      throw Boom.internal(error)
    })

  if (!agreement) {
    throw Boom.notFound(`Agreement not found ${agreementId}`)
  }

  return Promise.resolve(agreement)
}

export { getAgreementData }
