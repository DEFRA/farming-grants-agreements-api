import versionsModel from '#~/api/common/models/versions.js'
import grantModel from '#~/api/common/models/grant.js'
import agreementsModel from '#~/api/common/models/agreements.js'
import Boom from '@hapi/boom'

/**
 * Update one child agreement version based on migration flag.
 * @param {object} agreementFilter - The filter to find the parent agreement
 * @param {object} update - The update to apply to the child agreement version
 * @returns {Promise<object>} The updated child agreement version
 * @throws {Boom} 404 if no parent or child agreement found, 500 on other errors
 */
export const updateAgreementWithVersionViaGrant = async (
  agreementFilter,
  update
) => {
  let { agreementNumber, ...filter } = agreementFilter

  if (agreementNumber) {
    let agreementVersion = null

    const agreement = await agreementsModel
      .findOne({ agreementNumber })
      .sort({ createdAt: -1, _id: -1 })
      .select('agreementNumber')
      .lean()
      .catch((err) => {
        throw Boom.internal(err)
      })

    if (!agreement) {
      throw Boom.notFound(
        `Agreement not found using filter: ${JSON.stringify({ agreementNumber })}`
      )
    }

    const grant = await grantModel
      .findOne({ agreementNumber: agreement.agreementNumber })
      .sort({ createdAt: -1, _id: -1 })
      .lean()
      .catch((err) => {
        throw Boom.internal(err)
      })

    if (grant) {
      agreementVersion = await versionsModel
        .findOne({ grant: grant._id })
        .sort({ createdAt: -1, _id: -1 })
        .lean()
        .catch((err) => {
          throw Boom.internal(err)
        })
    }

    if (!agreementVersion) {
      throw Boom.notFound(
        `Latest version not found for grant associated with agreement ${agreementNumber}`
      )
    }

    filter = { _id: agreementVersion._id, ...filter }
  }

  const updated = await versionsModel
    .findOneAndUpdate(filter, update, {
      new: true,
      runValidators: true,
      lean: true
    })
    .populate('agreement')
    .sort({ createdAt: -1, _id: -1 })
    .catch((err) => {
      throw Boom.internal(err)
    })

  if (!updated) {
    throw Boom.notFound('Failed to update agreement. Agreement not found')
  }

  updated.agreementNumber = agreementNumber

  return updated
}
