import mongoose from 'mongoose'

const collection = 'agreements'

const schema = new mongoose.Schema(
  {
    agreementNumber: { type: String, required: true },
    clientRef: { type: String, required: true },
    sbi: { type: String, required: true },
    frn: { type: String },
    grants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'grants' }]
  },
  { collection, timestamps: true }
)

schema.index({ sbi: 1 })
schema.index({ agreementNumber: 1 }, { unique: true })
schema.index({ clientRef: 1 })
schema.index({ createdAt: 1 })

export default mongoose.model(collection, schema)
