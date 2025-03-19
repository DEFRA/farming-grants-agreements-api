/**
 * Get agreement data for rendering templates
 * @param {string} agreementId - The agreement ID to fetch
 * @param {object} options - Options object containing db and logger
 * @param {object} options.db - MongoDB database instance
 * @param {object} options.logger - Logger instance
 * @returns {Promise<object>} The agreement data
 */
async function getAgreementData(agreementId, { db, logger }) {
  try {
    const agreement = await db.collection('agreements').findOne({
      // TODO - Use agreement ID from request
      agreementNumber:
        'sample' && process.env.NODE_ENV !== 'production'
          ? 'SFI123456789'
          : agreementId
    })
    return agreement
  } catch (error) {
    logger.error(`Error getting agreement data: ${error}`)
    throw error
  }
}

export { getAgreementData }
