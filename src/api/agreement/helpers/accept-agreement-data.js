import Boom from '@hapi/boom'

/**
 * Get agreement data for rendering templates
 * @returns {object} The agreement data
 * @param {string} agreementId - The agreement ID to fetch
 * @param {object} logger - Logger instance
 */
async function acceptAgreement(agreementId, { db, logger }) {
  if (!agreementId) {
    throw Boom.badRequest('Agreement ID is required')
  }

  try {
    logger.info(`Fetching agreement data for agreement ${agreementId}`)

    const agreement = await db.updateOne(
      {
        agreementNumber:
          agreementId === 'sample' && process.env.NODE_ENV !== 'production'
            ? 'SFI123456789'
            : agreementId
      },
      {
        $set: {
          status: 'agreed',
          signatureDate: new Date().toISOString()
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
