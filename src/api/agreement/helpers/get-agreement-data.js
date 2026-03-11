import Boom from '@hapi/boom'
import versionsModel from '#~/api/common/models/versions.js'
import agreementsModel from '#~/api/common/models/agreements.js'

/**
 * Search for an agreement
 * @param {object} searchTerms - The search terms to use to find the agreement
 * @returns {Promise<Agreement>} The agreement data
 */
const searchForAgreement = async (searchTerms) => {
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
      },
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: 1 }
    ])
    .catch((error) => {
      throw Boom.internal(error)
    })

  return agreement?.[0]
}

export const getAgreementData = async (searchTerms) => {
  const agreementsData = await searchForAgreement(searchTerms)

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
      `Agreement version not found associated with the agreement Id ${agreementsData._id.toString()}`
    )
  }
  agreementVersion.agreementNumber = agreementsData.agreementNumber
  agreementVersion.invoice = agreementsData.invoice
  agreementVersion.version = agreementsData.versions?.length ?? 1

  return agreementVersion
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
 * Validate the SBI
 * @param {string|number} sbi - The SBI to validate
 */
const validateSbi = (sbi) => {
  if (sbi == null || String(sbi).trim() === '') {
    throw Boom.badRequest('SBI is required')
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
  return getAgreementData({
    agreementNumber: agreementId
  })
}

/**
 * Check if the agreement already exists
 * @param {object} searchTerms - The search terms to use to find the agreement
 * @returns {Promise<boolean>} Whether the agreement exists
 */
const doesAgreementExist = async (searchTerms) => {
  const agreements = await searchForAgreement(searchTerms)
  return Boolean(agreements)
}

/**
 * Get the agreement data by SBI (assumed unique)
 * @param {string|number} sbi - The SBI associated with the agreement
 * @returns {Promise<Agreement>} The agreement data
 */
const getAgreementDataBySbi = async (sbi) => {
  validateSbi(sbi)

  const agreementData = await getAgreementData({
    sbi: String(sbi)
  })

  return agreementData
}

export { getAgreementDataById, doesAgreementExist, getAgreementDataBySbi }

/** @import { Agreement } from '#~/api/common/types/agreement.d.js' */
