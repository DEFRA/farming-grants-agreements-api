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

const bsonReadOptions = { promoteValues: false }
const sourceDocumentOptions = {
  ...bsonReadOptions,
  projection: { __v: 0 }
}

const findAgreement = async (agreementNumber) => {
  const agreement = await agreementsModel.collection.findOne(
    { agreementNumber },
    sourceDocumentOptions
  )

  if (!agreement) {
    throw Boom.notFound('Woodland agreement not found')
  }

  return agreement
}

const findRelatedGrants = (agreementNumber, linkedGrantIds, offset) =>
  grantModel.collection
    .aggregate(
      [
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
                  $ifNull: [
                    { $arrayElemAt: ['$storedVersionHistory.ids', 0] },
                    []
                  ]
                }
              ]
            },
            versions: {
              $slice: [
                { $ifNull: ['$versions', []] },
                offset,
                VERSION_PAGE_SIZE
              ]
            }
          }
        },
        { $unset: ['__v', 'storedVersionHistory'] }
      ],
      bsonReadOptions
    )
    .toArray()

const requireLinkedGrant = (grants, linkedGrantIds, agreementNumber) => {
  if (grants.length === 0) {
    throw Boom.notFound('Grant not found for Woodland agreement')
  }

  if (grants.length > 1) {
    throw Boom.conflict('Woodland agreement has multiple related grants')
  }

  const [grant] = grants
  if (
    linkedGrantIds.length !== 1 ||
    grant.agreementNumber !== agreementNumber ||
    String(linkedGrantIds[0]) !== String(grant._id)
  ) {
    throw Boom.conflict('Woodland agreement grant linkage is inconsistent')
  }

  return grant
}

const requireConsistentVersionHistory = (grant) => {
  const totalVersions = Number(grant.totalVersions)
  if (
    Number(grant.uniqueVersionCount) !== totalVersions ||
    !grant.historyIsComplete
  ) {
    throw Boom.conflict('Woodland agreement version history is inconsistent')
  }

  return totalVersions
}

const findOrderedVersions = async (versionIds, grantId) => {
  const versions = await versionsModel.collection
    .find({ _id: { $in: versionIds }, grant: grantId }, sourceDocumentOptions)
    .toArray()
  const byId = new Map(
    versions.map((version) => [String(version._id), version])
  )
  const orderedVersions = versionIds.map((id) => byId.get(String(id)))

  if (orderedVersions.some((version) => !version)) {
    throw Boom.conflict('Woodland agreement version history is incomplete')
  }

  return orderedVersions
}

const serializeVersionPage = ({
  agreement,
  grant,
  versions,
  offset,
  totalVersions
}) => {
  const nextOffset = offset + versions.length
  delete agreement.grants
  delete grant.totalVersions
  delete grant.uniqueVersionCount
  delete grant.historyIsComplete
  delete grant.versions

  return {
    ...BSON.EJSON.serialize({ agreement, grant, versions }, { relaxed: false }),
    nextOffset: nextOffset < totalVersions ? nextOffset : null
  }
}

export const findWoodlandAgreementVersionPage = async (
  agreementNumber,
  offset
) => {
  if (!agreementNumber.startsWith('WMP')) {
    throw Boom.notFound('Woodland agreement not found')
  }

  const agreement = await findAgreement(agreementNumber)
  const linkedGrantIds = agreement.grants ?? []
  const grants = await findRelatedGrants(
    agreementNumber,
    linkedGrantIds,
    offset
  )
  const grant = requireLinkedGrant(grants, linkedGrantIds, agreementNumber)
  const totalVersions = requireConsistentVersionHistory(grant)
  const versions = await findOrderedVersions(grant.versions, grant._id)

  return serializeVersionPage({
    agreement,
    grant,
    versions,
    offset,
    totalVersions
  })
}
