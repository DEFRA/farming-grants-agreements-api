import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: String,
    required: true
  }
})

const agreementSchema = new mongoose.Schema(
  {
    agreementId: {
      type: String,
      required: true,
      unique: true
    },
    signatureDate: {
      type: Date
    },
    // Add other agreement fields as needed
    title: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed'],
      default: 'draft'
    },
    payments: [paymentSchema]
  },
  {
    timestamps: true
  }
)

export const Agreement = mongoose.model('Agreement', agreementSchema)
