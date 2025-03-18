import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Get agreement data for rendering templates
 * @returns {object} The agreement data
 * @param {string} agreementId - The agreement ID to fetch
 * @param {object} logger - Logger instance
 */
async function getAgreementData(agreementId, logger) {
  if (!agreementId) {
    throw Boom.badRequest('Agreement ID is required')
  }

  try {
    logger.info(`Fetching agreement data for agreement ${agreementId}`)

    const agreement = await agreementsModel
      .findOne({
        agreementNumber:
          agreementId === 'sample' && process.env.NODE_ENV !== 'production'
            ? 'SFI123456789'
            : agreementId
      })
      .lean()

    if (!agreement) {
      logger.warn(`Agreement not found for agreement ${agreementId}`)
      throw Boom.notFound('Agreement not found')
    }

    logger.info(
      `Successfully retrieved agreement data for agreement ${agreementId}`
    )
    return agreement
  } catch (error) {
    logger.error(`Error fetching agreement data for agreement ${agreementId}`, {
      error: error.message,
      stack: error.stack
    })

    if (error.isBoom) {
      throw error
    }

    throw Boom.internal('Failed to fetch agreement data')
  }
}

export { getAgreementData }
