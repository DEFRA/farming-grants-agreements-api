import agreementsModel from '#~/api/common/models/agreements.js'
import versionsModel from '#~/api/common/models/versions.js'
import grantModel from '#~/api/common/models/grant.js'
import { createLogger } from '#~/api/common/helpers/logging/logger.js'

const logger = createLogger()

function assertValidCreateArgs(agreement, versions) {
  if (!agreement?.agreementNumber) {
    throw new Error('agreement.agreementNumber is required')
  }
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error(
      'versions must be a non-empty array of agreement version payloads'
    )
  }
}

function ignorePayments(versions) {
  versions.forEach((version) => {
    version.payment = null
  })
}

/**
 * Finds an existing agreement by SBI or creates a new one.
 * @param {object} agreement - The agreement base data
 * @returns {Promise<object>} The agreement document (lean)
 */
async function findOrCreateAgreement(agreement) {
  const existing = await agreementsModel
    .findOne({ sbi: agreement.sbi })
    .sort({ createdAt: -1, _id: -1 })
    .select('_id versions agreementNumber grants')
    .lean()

  if (existing) {
    return existing
  }

  return agreementsModel.create({
    agreementNumber: agreement.agreementNumber,
    clientRef: agreement.clientRef,
    sbi: agreement.sbi,
    frn: agreement.frn,
    versions: [],
    grants: []
  })
}

/**
 * Finds an existing grant by agreement number or creates a new one.
 * @param {object} params - Parameters
 * @param {string} params.agreementNumber - The agreement number
 * @param {string} params.agreementId - The agreement ID
 * @param {object} params.agreementBase - Original agreement base data
 * @param {object} params.latestVersion - The latest version payload
 * @returns {Promise<string>} The grant ID
 */
async function findOrCreateGrant({
  agreementNumber,
  agreementId,
  agreementBase,
  latestVersion
}) {
  const existingGrant = await grantModel
    .findOne({ agreementNumber })
    .sort({ createdAt: -1, _id: -1 })
    .select('_id')
    .lean()

  if (existingGrant) {
    return existingGrant._id
  }

  const newGrant = await grantModel.create({
    code: latestVersion.code,
    name: latestVersion.scheme,
    agreementNumber,
    clientRef: agreementBase.clientRef,
    sbi: agreementBase.sbi,
    frn: agreementBase.frn,
    claimId: latestVersion.claimId,
    versions: []
  })

  // Link grant to agreement
  await agreementsModel.updateOne(
    { _id: agreementId },
    { $push: { grants: newGrant._id } }
  )

  return newGrant._id
}

/**
 * Inserts versions and links them to agreement and grant.
 * @param {object} params - Parameters
 * @param {Array<object>} params.versions - The version payloads
 * @param {string} params.agreementId - The agreement ID
 * @param {string} params.grantId - The grant ID
 * @returns {Promise<Array<object>>} The inserted versions
 */
async function insertAndAssociateVersions({ versions, agreementId, grantId }) {
  const versionsToInsert = versions.map((v) => ({
    ...v,
    agreement: agreementId,
    grant: grantId
  }))

  const inserted = await versionsModel.insertMany(versionsToInsert)
  const insertedIds = inserted.map((v) => v._id)

  await agreementsModel.updateOne(
    { _id: agreementId },
    { $push: { versions: { $each: insertedIds } } }
  )

  await grantModel.updateOne(
    { _id: grantId },
    { $push: { versions: { $each: insertedIds } } }
  )

  return inserted
}

/**
 * Creates an agreement with its associated grant and versions.
 * If the agreement already exists, it reuses it and its associated grant.
 * @param {object} params - The parameters for creation
 * @param {object} params.agreement - The agreement base data
 * @param {Array<object>} params.versions - The version payloads
 * @returns {Promise<object>} The populated agreement
 */
export async function createAgreementWithGrantAndVersions({
  agreement,
  versions
}) {
  assertValidCreateArgs(agreement, versions)
  ignorePayments(versions)

  try {
    const agreementData = await findOrCreateAgreement(agreement)
    const agreementId = agreementData._id

    const grantId = await findOrCreateGrant({
      agreementNumber: agreementData.agreementNumber,
      agreementId,
      agreementBase: agreement,
      latestVersion: versions.at(-1)
    })

    await insertAndAssociateVersions({
      versions,
      agreementId,
      grantId
    })

    return agreementsModel
      .findById(agreementId)
      .populate({
        path: 'versions',
        select: 'agreementNumber sbi status createdAt',
        options: { sort: { createdAt: -1, _id: -1 } }
      })
      .populate('grants')
      .lean()
  } catch (err) {
    logger.error(err, 'Error in createAgreementWithGrantAndVersions')
    throw err
  }
}
