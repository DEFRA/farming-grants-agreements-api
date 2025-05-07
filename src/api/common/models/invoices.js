import mongoose from 'mongoose'

const collection = 'invoices'

const schema = new mongoose.Schema(
  {
    agreementNumber: { type: String, required: true },
    invoiceNumber: { type: String, required: true },
    correlationId: { type: String, required: true }
  },
  {
    collection,
    timestamps: true
  }
)

// Indexes for common queries
schema.index({ agreementNumber: 1 })
schema.index({ invoiceNumber: 1 }, { unique: true })
schema.index({ correlationId: 1 })

export default mongoose.model(collection, schema)
