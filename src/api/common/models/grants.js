import mongoose from 'mongoose'

const { Schema } = mongoose

const collection = 'grants'

const schema = new Schema(
  {
    grantNumber: { type: String, required: true },
    name: { type: String, required: true },
    agreementNumber: { type: String, required: true },
    sbi: { type: String, required: true },
    frn: { type: String },
    versions: [{ type: Schema.Types.ObjectId, ref: 'versions' }]
  },
  { collection, timestamps: true }
)

schema.index({ grantNumber: 1 }, { unique: true })
schema.index({ clientRef: 1 })
schema.index({ createdAt: 1 })

export default mongoose.model(collection, schema)
