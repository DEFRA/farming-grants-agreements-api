import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Get agreement data for rendering templates
 * @returns {object} The agreement data
 * @param {string} agreementId - The agreement ID to fetch
 * @param {object} logger - Logger instance
 * @param {string} username - The username of the person accepting the agreement
 */
async function acceptAgreement(agreementId, logger, username) {
  if (!agreementId) {
    throw Boom.badRequest('Agreement ID is required')
  }

  if (!username) {
    throw Boom.badRequest('Username is required')
  }

  try {
    logger.info(`Fetching agreement data for agreement ${agreementId}`)

    const agreement = await agreementsModel.updateOne(
      {
        agreementNumber:
          agreementId === 'sample' && process.env.NODE_ENV !== 'production'
            ? 'SFI123456789'
            : agreementId
      },
      {
        $set: {
          status: 'agreed',
          signatureDate: new Date().toISOString(),
          username
        }
      }
    )

    if (!agreement) {
      logger.warn(`Agreement not found for agreement ${agreementId}`)
      throw Boom.notFound('Agreement not found')
    }

    logger.info(
      `Successfully accepted agreement data for agreement ${agreementId}`
    )
    return agreement
  } catch (error) {
    logger.error(
      `Error accepting agreement data for agreement ${agreementId}`,
      {
        error: error.message,
        stack: error.stack
      }
    )

    if (error.isBoom) {
      throw error
    }

    throw Boom.internal('Failed to accept agreement data')
  }
}

export { acceptAgreement }
