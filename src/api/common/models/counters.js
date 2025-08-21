import mongoose from 'mongoose'
import { z } from 'zod'
import { zodSchema as zodMongooseSchema } from '@zodyac/zod-mongoose'

const collection = 'counters'

const counterSchema = z.object({
  _id: z.string(),
  seq: z.number()
})

const schema = zodMongooseSchema(counterSchema, {
  collection,
  timestamps: false
})

export default mongoose.model(collection, schema)
