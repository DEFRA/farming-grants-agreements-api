import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Get agreement data for rendering templates
 * @param {object} searchTerms - The search terms to use to find the agreement
 * @returns {Promise<Agreement>} The agreement data
 */
const getAgreementData = async (searchTerms) => {
  const agreement = await agreementsModel
    .aggregate([
      {
        $match: searchTerms
      },
      {
        $lookup: {
          from: 'invoices',
          localField: 'agreementNumber',
          foreignField: 'agreementNumber',
          as: 'invoice'
        }
      }
    ])
    .catch((error) => {
      throw Boom.internal(error)
    })

  if (!agreement[0]) {
    throw Boom.notFound(
      `Agreement not found using search terms: ${JSON.stringify(searchTerms)}`
    )
  }

  return Promise.resolve(agreement[0])
}

export { getAgreementData }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
