import mongoose from 'mongoose'
import versionsModel from './versions.js'
import Boom from '@hapi/boom'

const collection = 'agreements'

const schema = new mongoose.Schema(
  {
    agreementNumber: { type: String, required: true },
    frn: { type: String, required: true },
    sbi: { type: String, required: true },
    versions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'versions' }],
    createdBy: { type: String }
  },
  { collection, timestamps: true }
)

// Helpful indexes
schema.index({ sbi: 1 })
schema.index({ agreementNumber: 1 }, { unique: true })
schema.index({ createdAt: 1 })

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

schema.statics.createAgreementWithVersions = async function ({
  agreement,
  versions
}) {
  assertValidCreateArgs(agreement, versions)

  const createdversions = []
  let agreementId = null

  try {
    // A) see if parent exists (by unique agreementNumber)
    const existing = await this.findOne({
      frn: agreement.frn,
      sbi: agreement.sbi
    })
      .select('_id versions')
      .lean()

    if (existing) {
      agreementId = existing._id
    } else {
      // create a minimal parent first (no children yet)
      const newParent = await this.create({
        agreementNumber: agreement.agreementNumber,
        frn: agreement.frn,
        sbi: agreement.sbi,
        createdBy: agreement.createdBy,
        versions: []
      })
      agreementId = newParent._id
    }

    // B) insert child docs
    const inserted = await versionsModel.insertMany(versions)
    createdversions.push(...inserted)
    const insertedIds = inserted.map((a) => a._id)

    // C) back-link children → parent
    await versionsModel.updateMany(
      { _id: { $in: insertedIds } },
      { $set: { agreement: agreementId } }
    )

    // D) append only new ids to parent's versions (de-dup)
    //    (If parent was newly created, it’s just all insertedIds)
    let idsToAppend = insertedIds
    if (existing?.versions?.length) {
      const existingSet = new Set(existing.versions.map((id) => String(id)))
      idsToAppend = insertedIds.filter((id) => !existingSet.has(String(id)))
    }

    if (idsToAppend.length) {
      await this.updateOne(
        { _id: agreementId },
        { $push: { versions: { $each: idsToAppend } } }
      )
    }

    // E) return populated agreement
    return this.findById(agreementId)
      .populate({
        path: 'versions',
        select: 'agreementNumber sbi status createdAt'
      })
      .lean()
  } catch (err) {
    // best-effort cleanup: if we created a brand new parent this call and then failed, remove it
    try {
      if (agreementId) {
        await this.deleteOne({ _id: agreementId })
      }
      if (createdversions.length) {
        await versionsModel.deleteMany({
          _id: { $in: createdversions.map((a) => a._id) }
        })
      }
    } catch (_) {
      // swallow cleanup errors, original error wins
    }
    throw err
  }
}

/**
 * Update one child agreement that belongs to a agreement.
 *
 */

schema.statics.updateOneAgreementVersion = async function (
  agreementFilter,
  update
) {
  // 1) find the parent agreement and get its child ids
  const agreement = await this.findOne(agreementFilter)
    .select('versions')
    .lean()
    .catch((err) => {
      throw Boom.internal(err)
    })

  if (!agreement) {
    throw Boom.notFound(
      `Agreement not found using filter: ${JSON.stringify(agreementFilter)}`
    )
  }

  if (!agreement.versions || agreement.versions.length === 0) {
    throw Boom.notFound('Agreement has no child versions to update')
  }

  const agreementVersion = await versionsModel
    .findOne({ agreement: agreement._id })
    .sort({ createdAt: -1, _id: -1 })
    .lean()
    .catch((err) => {
      throw Boom.internal(err)
    })

  // 3) update the child agreement
  const updated = await versionsModel
    .findOneAndUpdate({ _id: agreementVersion._id }, update, {
      new: true,
      runValidators: true,
      lean: true
    })
    .catch((err) => {
      throw Boom.internal(err)
    })

  if (!updated) {
    throw Boom.internal('Failed to update the child agreement')
  }

  return updated
}

export default mongoose.model(collection, schema)
