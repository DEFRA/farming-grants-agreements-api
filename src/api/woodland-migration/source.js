import Boom from '@hapi/boom'
import { BSON } from 'mongodb'

import agreementsModel from '#~/api/common/models/agreements.js'
import grantModel from '#~/api/common/models/grant.js'
import versionsModel from '#~/api/common/models/versions.js'

const VERSION_PAGE_SIZE = 100

const woodlandAgreementNumber = /^WMP/

export const findWoodlandAgreementNumbers = async () => {
  const agreementNumbers = await agreementsModel.distinct('agreementNumber', {
    agreementNumber: woodlandAgreementNumber
  })

  return agreementNumbers.sort()
}

export const findWoodlandAgreementVersionPage = async (
  agreementNumber,
  offset
) => {
  if (!agreementNumber.startsWith('WMP')) {
    throw Boom.notFound('Woodland agreement not found')
  }

  const agreement = await agreementsModel
    .findOne({ agreementNumber })
    .select('-grants -__v')
    .lean()

  if (!agreement) {
    throw Boom.notFound('Woodland agreement not found')
  }

  const [grant] = await grantModel.aggregate([
    { $match: { agreementNumber } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: 1 },
    {
      $set: {
        totalVersions: { $size: { $ifNull: ['$versions', []] } },
        versions: {
          $slice: [{ $ifNull: ['$versions', []] }, offset, VERSION_PAGE_SIZE]
        }
      }
    },
    { $unset: '__v' }
  ])

  if (!grant) {
    throw Boom.notFound('Grant not found for Woodland agreement')
  }

  const versionIds = grant.versions
  const versions = await versionsModel
    .find({ _id: { $in: versionIds }, grant: grant._id })
    .select('-__v')
    .lean()
  const byId = new Map(
    versions.map((version) => [String(version._id), version])
  )
  const orderedVersions = versionIds.map((id) => byId.get(String(id)))

  if (orderedVersions.some((version) => !version)) {
    throw Boom.conflict('Woodland agreement version history is incomplete')
  }

  const nextOffset = offset + versionIds.length
  const totalVersions = grant.totalVersions
  delete grant.totalVersions
  delete grant.versions

  return BSON.EJSON.serialize({
    agreement,
    grant,
    versions: orderedVersions,
    nextOffset: nextOffset < totalVersions ? nextOffset : null
  })
}
