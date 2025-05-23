import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Get agreement data for rendering templates
 * @param {any} searchTerms - The search terms to use to find the agreement
 * @returns {Promise<Agreement>} The agreement data
 */
const getAgreementData = async (searchTerms) => {
  const agreement = await agreementsModel
    .findOne(searchTerms)
    .lean()
    .catch((error) => {
      throw Boom.internal(error)
    })

  if (!agreement) {
    throw Boom.notFound(
      `Agreement not found using search terms: ${JSON.stringify(searchTerms)}`
    )
  }

  return Promise.resolve(agreement)
}

export { getAgreementData }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
