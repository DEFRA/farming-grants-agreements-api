import mongoose from 'mongoose'
import { z } from 'zod'
import { zodSchema as zodMongooseSchema } from '@zodyac/zod-mongoose'

const collection = 'invoices'

const invoiceSchema = z.object({
  agreementNumber: z
    .string()
    .describe('ID of the agreement this invoice is for'),
  invoiceNumber: z.string().describe('The invoice ID'),
  correlationId: z.string().describe('The correlation ID for tracking'),
  paymentHubRequest: z.record(z.any()).default({}).optional()
})

export const zodSchema = {
  collection,
  schema: invoiceSchema
}

const schema = zodMongooseSchema(invoiceSchema, {
  collection,
  timestamps: true
})

// Indexes for common queries
schema.index({ agreementNumber: 1 })
schema.index({ invoiceNumber: 1 }, { unique: true })
schema.index({ correlationId: 1 })

export default mongoose.model(collection, schema)
