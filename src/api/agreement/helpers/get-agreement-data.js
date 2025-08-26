import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'
import agreementGroupModel from '~/src/api/common/models/agreement_groups.js'

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

/**
 * Get agreement data for rendering templates
 * @param {object} searchTerms - The search terms to use to find the agreement
 * @returns {Promise<Agreement>} The agreement data
 */
const getAgreementData = async (searchTerms) => {
  const agreement = await searchForAgreement(searchTerms)

  if (!agreement?.[0]) {
    throw Boom.notFound(
      `Agreement not found using search terms: ${JSON.stringify(searchTerms)}`
    )
  }

  return Promise.resolve(agreement[0])
}

export const getAgreementGroupData = async (searchTerms) => {
  if (!searchTerms || typeof searchTerms !== 'object') {
    throw Boom.badRequest('searchTerms must be an object')
  }

  const agreementsGroup = await agreementGroupModel
    .findOne(searchTerms)
    .select('_id agreementNumber agreementName')
    .catch((err) => {
      throw Boom.internal(err)
    })

  if (!agreementsGroup) {
    throw Boom.notFound(
      `AgreementsGroup not found using search terms: ${JSON.stringify(searchTerms)}`
    )
  }

  const agreementData = await agreementsModel
    .findOne({ agreementGroup: agreementsGroup._id })
    .sort({ createdAt: -1, _id: -1 })
    .lean()
    .catch((err) => {
      throw Boom.internal(err)
    })

  if (!agreementData) {
    throw Boom.notFound(
      `Agreement not found with the group Id ${agreementsGroup._id.toString()}`
    )
  }
  agreementData.agreementNumber = agreementsGroup.agreementNumber

  return Promise.resolve(agreementData)
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
  const agreementData = await getAgreementGroupData({
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
  const agreement = await searchForAgreement(searchTerms)
  return agreement.length > 0
}

export { getAgreementDataById, getAgreementData, doesAgreementExist }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
