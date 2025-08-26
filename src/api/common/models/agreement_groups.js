import mongoose from 'mongoose'
import agreementsModel from './agreements.js'
import Boom from '@hapi/boom'

const collection = 'agreement_groups'

const schema = new mongoose.Schema(
  {
    agreementNumber: { type: String, required: true },
    frn: { type: String, required: true },
    sbi: { type: String, required: true },
    agreementName: { type: String, required: true },
    agreements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'agreements' }],
    createdBy: { type: String }
  },
  { collection, timestamps: true }
)

// Helpful indexes
schema.index({ sbi: 1 })
schema.index({ agreementNumber: 1 }, { unique: true })
schema.index({ createdAt: 1 })

schema.statics.createWithAgreements = async function ({ group, agreements }) {
  if (!group?.agreementNumber || !group?.agreementName) {
    throw new Error(
      'group.agreementNumber and group.agreementName are required'
    )
  }
  if (!Array.isArray(agreements) || agreements.length === 0) {
    throw new Error(
      'agreements must be a non-empty array of agreement payloads'
    )
  }

  const createdAgreements = []
  let groupId = null
  let createdNewParent = false

  try {
    // A) see if parent exists (by unique agreementNumber)
    const existing = await this.findOne({ frn: group.frn, sbi: group.sbi })
      .select('_id agreements')
      .lean()

    if (existing) {
      groupId = existing._id
    } else {
      // create a minimal parent first (no children yet)
      const newParent = await this.create({
        agreementNumber: group.agreementNumber,
        frn: group.frn,
        sbi: group.sbi,
        agreementName: group.agreementName,
        createdBy: group.createdBy,
        agreements: []
      })
      groupId = newParent._id
      createdNewParent = true
    }

    // B) insert child docs
    const inserted = await agreementsModel.insertMany(agreements)
    createdAgreements.push(...inserted)
    const insertedIds = inserted.map((a) => a._id)

    // C) back-link children → parent
    await agreementsModel.updateMany(
      { _id: { $in: insertedIds } },
      { $set: { agreementGroup: groupId } }
    )

    // D) append only new ids to parent's agreements (de-dup)
    //    (If parent was newly created, it’s just all insertedIds)
    let idsToAppend = insertedIds
    if (existing?.agreements?.length) {
      const existingSet = new Set(existing.agreements.map((id) => String(id)))
      idsToAppend = insertedIds.filter((id) => !existingSet.has(String(id)))
    }

    if (idsToAppend.length) {
      await this.updateOne(
        { _id: groupId },
        { $push: { agreements: { $each: idsToAppend } } }
      )
    }

    // E) return populated group
    return this.findById(groupId)
      .populate({
        path: 'agreements',
        select: 'agreementNumber sbi status createdAt'
      })
      .lean()
  } catch (err) {
    // best-effort cleanup: if we created a brand new parent this call and then failed, remove it
    try {
      if (createdNewParent && groupId) {
        await this.deleteOne({ _id: groupId })
      }
      if (createdAgreements.length) {
        await agreementsModel.deleteMany({
          _id: { $in: createdAgreements.map((a) => a._id) }
        })
      }
    } catch (_) {
      // swallow cleanup errors, original error wins
    }
    throw err
  }
}

schema.statics.createWithAgreementsOld = async function ({
  group,
  agreements
}) {
  if (!group?.agreementNumber || !group?.agreementName) {
    throw new Error(
      'group.agreementNumber and group.agreementName are required'
    )
  }
  if (!Array.isArray(agreements) || agreements.length === 0) {
    throw new Error(
      'agreements must be a non-empty array of agreement payloads'
    )
  }

  const createdAgreements = []
  let createdGroup = null

  try {
    // 1) create child docs
    const inserted = await agreementsModel.insertMany(agreements)
    createdAgreements.push(...inserted)
    const ids = inserted.map((a) => a._id)

    // 2) create parent
    createdGroup = await this.create({ ...group, agreements: ids })

    // 3) back-link children → parent
    await agreementsModel.updateMany(
      { _id: { $in: ids } },
      { $set: { agreementGroup: createdGroup._id } }
    )

    // Optional: return populated
    return this.findById(createdGroup._id)
      .populate({ path: 'agreements', select: 'agreementNumber sbi status' })
      .lean()
  } catch (err) {
    // Compensating actions (best-effort)
    try {
      // If parent created but back-link failed, remove parent
      if (createdGroup?._id) {
        await this.deleteOne({ _id: createdGroup._id })
      }
      // If children created but parent failed, remove children
      if (createdAgreements.length) {
        await agreementsModel.deleteMany({
          _id: { $in: createdAgreements.map((a) => a._id) }
        })
      }
    } catch (_) {
      // swallow cleanup errors; original error is what matters
    }
    throw err
  }
}

/**
 * Update one child agreement that belongs to a group.
 *
 */

schema.statics.updateOneAgreement = async function (
  groupFilter,
  update,
  opts = {}
) {
  const { which = 'first', agreementId } = opts

  // 1) find the parent group and get its child ids
  const group = await this.findOne(groupFilter)
    .select('agreements')
    .lean()
    .catch((err) => {
      throw Boom.internal(err)
    })

  if (!group) {
    throw Boom.notFound(
      `Agreement group not found using filter: ${JSON.stringify(groupFilter)}`
    )
  }

  if (!group.agreements || group.agreements.length === 0) {
    throw Boom.notFound('Agreement group has no child agreements to update')
  }

  // 2) decide which child to update
  let targetId
  if (which === 'first') {
    targetId = group.agreements[0]
  } else if (which === 'byId') {
    if (!agreementId) {
      throw Boom.badRequest('agreementId is required when opts.which is "byId"')
    }
    // ensure the requested id actually belongs to the group
    const found = group.agreements.find(
      (id) => id.toString() === String(agreementId)
    )
    if (!found) {
      throw Boom.notFound(
        'Requested agreementId does not belong to the specified group'
      )
    }
    targetId = found
  }

  // 3) update the child agreement
  const updated = await agreementsModel
    .findOneAndUpdate({ _id: targetId }, update, {
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
