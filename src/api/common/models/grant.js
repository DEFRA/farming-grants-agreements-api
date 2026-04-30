import mongoose from 'mongoose'

const { Schema } = mongoose

const collection = 'grants'

const schema = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    agreementNumber: { type: String, required: true },
    clientRef: { type: String, required: true },
    sbi: { type: String, required: true },
    frn: { type: String },
    claimId: { type: String },
    versions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'versions' }]
  },
  { collection, timestamps: true }
)

schema.index({ name: 1 })
schema.index({ clientRef: 1 })
schema.index({ createdAt: 1 })

export default mongoose.model(collection, schema)
