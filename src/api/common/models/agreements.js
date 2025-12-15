import mongoose from 'mongoose'
import versionsModel from './versions.js'
import Boom from '@hapi/boom'

const collection = 'agreements'

const schema = new mongoose.Schema(
  {
    agreementNumber: { type: String, required: true },
    clientRef: { type: String, required: true },
    sbi: { type: String, required: true },
    frn: { type: String },
    versions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'versions' }]
  },
  { collection, timestamps: true }
)

schema.index({ sbi: 1 })
schema.index({ agreementNumber: 1 }, { unique: true })
schema.index({ clientRef: 1 })
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

function ignorePayments(versions) {
  versions.forEach((version) => {
    version.payment = null
  })
}

schema.statics.createAgreementWithVersions = async function ({
  agreement,
  versions
}) {
  assertValidCreateArgs(agreement, versions)
  ignorePayments(versions)

  const createdversions = []
  let agreementId = null

  try {
    // A) see if parent exists (by unique agreementNumber)
    const existing = await this.findOne({ sbi: agreement.sbi })
      .select('_id versions')
      .lean()

    if (existing) {
      agreementId = existing._id
    } else {
      // create a minimal parent first (no children yet)
      const newParent = await this.create({
        agreementNumber: agreement.agreementNumber,
        clientRef: agreement.clientRef,
        sbi: agreement.sbi,
        frn: agreement.frn,
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
 * Find the latest agreement version.
 * @param {object} agreementFilter - The filter to find the parent agreement
 * @returns {Promise<Agreement>} The updated child agreement
 */
schema.statics.findLatestAgreementVersion = async function (agreementFilter) {
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

  return versionsModel
    .findOne({ agreement: agreement._id })
    .sort({ createdAt: -1, _id: -1 })
    .lean()
    .catch((err) => {
      throw Boom.internal(err)
    })
}

/**
 * Update one child agreement that belongs to a agreement.
 * @param {object} agreementFilter - The filter to find the parent agreement
 * @param {object} update - The update to apply to the child agreement
 * @returns {Promise<Agreement>} The updated child agreement
 * @throws {Boom} 404 if no parent or child agreement found, 500 on other errors
 */
schema.statics.updateOneAgreementVersion = async function (
  agreementFilter,
  update
) {
  let { agreementNumber, ...filter } = agreementFilter

  if (agreementNumber) {
    const agreementVersion = await this.findLatestAgreementVersion({
      agreementNumber
    })

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

export default mongoose.model(collection, schema)
