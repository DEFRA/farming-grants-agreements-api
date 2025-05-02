import mongoose from 'mongoose'

const collection = 'counters'

const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true }
  },
  {
    collection,
    timestamps: false
  }
)

export default mongoose.model(collection, schema)
