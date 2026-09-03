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

  return agreementNumbers.sort((left, right) => left.localeCompare(right))
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
    .select('-__v')
    .lean()

  if (!agreement) {
    throw Boom.notFound('Woodland agreement not found')
  }

  const linkedGrantIds = agreement.grants ?? []
  const grants = await grantModel.aggregate([
    {
      $match: {
        $or: [{ _id: { $in: linkedGrantIds } }, { agreementNumber }]
      }
    },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: 2 },
    {
      $lookup: {
        from: 'versions',
        let: { grantId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$grant', '$$grantId'] } } },
          { $group: { _id: null, ids: { $addToSet: '$_id' } } }
        ],
        as: 'storedVersionHistory'
      }
    },
    {
      $set: {
        totalVersions: { $size: { $ifNull: ['$versions', []] } },
        uniqueVersionCount: {
          $size: { $setUnion: [{ $ifNull: ['$versions', []] }, []] }
        },
        historyIsComplete: {
          $setEquals: [
            { $ifNull: ['$versions', []] },
            {
              $ifNull: [{ $arrayElemAt: ['$storedVersionHistory.ids', 0] }, []]
            }
          ]
        },
        versions: {
          $slice: [{ $ifNull: ['$versions', []] }, offset, VERSION_PAGE_SIZE]
        }
      }
    },
    { $unset: ['__v', 'storedVersionHistory'] }
  ])

  if (grants.length === 0) {
    throw Boom.notFound('Grant not found for Woodland agreement')
  }

  if (grants.length > 1) {
    throw Boom.conflict('Woodland agreement has multiple related grants')
  }

  const [grant] = grants
  if (
    grant.agreementNumber !== agreementNumber ||
    !linkedGrantIds.some((grantId) => String(grantId) === String(grant._id))
  ) {
    throw Boom.conflict('Woodland agreement grant linkage is inconsistent')
  }

  delete agreement.grants

  if (
    grant.uniqueVersionCount !== grant.totalVersions ||
    !grant.historyIsComplete
  ) {
    throw Boom.conflict('Woodland agreement version history is inconsistent')
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
  delete grant.uniqueVersionCount
  delete grant.historyIsComplete
  delete grant.versions

  return {
    ...BSON.EJSON.serialize(
      { agreement, grant, versions: orderedVersions },
      { relaxed: false }
    ),
    nextOffset: nextOffset < totalVersions ? nextOffset : null
  }
}
