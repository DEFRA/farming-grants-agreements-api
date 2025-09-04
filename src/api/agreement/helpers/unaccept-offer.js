import Boom from '@hapi/boom'
import agreementModel from '~/src/api/common/models/agreements.js'
import versionsModel from '~/src/api/common/models/versions.js'

/**
 * Unaccepts an agreement and changes its status back to Offered
 * @param {string} agreementId - The agreement ID to update
 * @returns {Promise<object>} The updated agreement data
 */
async function unacceptOffer(agreementId) {
  // First, find the agreement by agreementNumber to ensure it exists and get its versions
  const agreement = await agreementModel
    .findOne({ agreementNumber: agreementId })
    .populate('versions')
    .lean()
    .exec()
    .catch((error) => {
      throw Boom.internal(error)
    })

  if (!agreement) {
    throw Boom.notFound(
      `Agreement not found with agreementNumber ${agreementId}`
    )
  }

  // Update all versions of this agreement
  const result = await versionsModel
    .updateMany(
      { _id: { $in: agreement.versions } },
      {
        $set: {
          status: 'offered',
          signatureDate: null
        }
      }
    )
    .catch((error) => {
      throw Boom.internal(`Failed to update versions: ${error.message}`)
    })

  if (result.matchedCount === 0) {
    throw Boom.notFound(`No versions found for agreement ${agreementId}`)
  }

  return { success: true, updatedVersions: result.modifiedCount }
}

export { unacceptOffer }
