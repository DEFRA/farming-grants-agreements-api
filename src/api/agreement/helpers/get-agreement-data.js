import Boom from '@hapi/boom'
import versionsModel from '~/src/api/common/models/versions.js'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Search for an agreement
 * @param {object} searchTerms - The search terms to use to find the agreement
 * @returns {Promise<Agreement>} The agreement data
 */
const searchForAgreement = (searchTerms) =>
  agreementsModel
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

export const getAgreementData = async (searchTerms) => {
  if (!searchTerms || typeof searchTerms !== 'object') {
    throw Boom.badRequest('searchTerms must be an object')
  }

  const agreementsData = await agreementsModel
    .findOne(searchTerms)
    .select('_id agreementNumber agreementName')
    .catch((err) => {
      throw Boom.internal(err)
    })

  if (!agreementsData) {
    throw Boom.notFound(
      `Agreement not found using search terms: ${JSON.stringify(searchTerms)}`
    )
  }

  const agreementVersion = await versionsModel
    .findOne({ agreement: agreementsData._id })
    .sort({ createdAt: -1, _id: -1 })
    .lean()
    .catch((err) => {
      throw Boom.internal(err)
    })

  if (!agreementVersion) {
    throw Boom.notFound(
      `Agreement not found with the group Id ${agreementVersion._id.toString()}`
    )
  }
  agreementVersion.agreementNumber = agreementsData.agreementNumber

  return Promise.resolve(agreementVersion)
}

/**
 * Validate the agreement ID
 * @param {string} agreementId - The agreement ID to validate
 */
const validateAgreementId = (agreementId) => {
  if (!agreementId || agreementId === '') {
    throw Boom.badRequest('Agreement ID is required')
  }
}

/**
 * Get the agreement data before accepting
 * @param {string} agreementId - The agreement ID to fetch
 * @returns {Promise<Agreement>} The agreement data
 */
const getAgreementDataById = async (agreementId) => {
  validateAgreementId(agreementId)

  // Get the agreement data before accepting
  const agreementData = await getAgreementData({
    agreementNumber: agreementId
  })

  return agreementData
}

/**
 * Check if the agreement already exists
 * @param {object} searchTerms - The search terms to use to find the agreement
 * @returns {Promise<boolean>} Whether the agreement exists
 */
const doesAgreementExist = async (searchTerms) => {
  const agreements = await searchForAgreement(searchTerms)
  return agreements.length > 0
}

export { getAgreementDataById, doesAgreementExist }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
