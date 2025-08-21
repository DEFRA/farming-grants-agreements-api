import mongoose from 'mongoose'
import { z } from 'zod'
import { zodSchema as zodMongooseSchema } from '@zodyac/zod-mongoose'

const collection = 'agreements'

const actionSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .describe('The unique identifier code for the action'),
    title: z.string().min(1).describe('The title or name of the action'),
    startDate: z.coerce.date().describe('The date when the action begins'),
    endDate: z.coerce.date().describe('The date when the action ends'),
    duration: z.string().min(1).describe('The duration of the action')
  })
  .describe('Represents an action in the system')

const parcelActivitySchema = z
  .object({
    code: z
      .string()
      .min(1)
      .describe('The unique identifier code for the activity'),
    description: z
      .string()
      .default('')
      .describe('The description of the activity'),
    area: z.number().describe('The area covered by the activity'),
    startDate: z.coerce.date().describe('The date when the activity begins'),
    endDate: z.coerce.date().describe('The date when the activity ends')
  })
  .describe('Represents an activity in the system')

const paymentsActivitySchema = z.object({
  code: z
    .string()
    .min(1)
    .describe('The unique identifier code for the activity'),
  description: z
    .string()
    .default('')
    .describe('The description of the activity'),
  quantity: z.number().describe('Quantity for payment calculation'),
  rate: z.number().describe('Rate for payment calculation'),
  measurement: z.string().min(1).describe('Measurement unit for payment'),
  paymentRate: z.string().min(1).describe('Payment rate description'),
  annualPayment: z.number().describe('Annual payment amount')
})

const parcelSchema = z
  .object({
    parcelNumber: z
      .string()
      .min(1)
      .describe('The unique identifier for the parcel'),
    parcelName: z
      .string()
      .optional()
      .default('')
      .describe('The name of the parcel (optional with default empty string)'),
    totalArea: z.number().describe('The total area of the parcel'),
    activities: z
      .array(parcelActivitySchema)
      .optional()
      .default([])
      .describe(
        'Array of activities associated with the parcel (optional with default empty array)'
      )
  })
  .describe('Represents a land parcel schema structure.')

const yearlyBreakdownSchema = z
  .object({
    details: z
      .array(z.object({}))
      .default([])
      .describe('Array of detail objects for the breakdown'),
    annualTotals: z
      .object({
        year1: z.number().describe('Payment total for year 1'),
        year2: z.number().describe('Payment total for year 2'),
        year3: z.number().describe('Payment total for year 3')
      })
      .describe('The annual payment totals'),
    totalAgreementPayment: z
      .number()
      .describe('The total payment amount for the entire agreement')
  })
  .describe('Represents the yearly breakdown of agreement payments')

const paymentsSchema = z.object({
  activities: z
    .array(paymentsActivitySchema)
    .default([])
    .describe('Array of activities associated with the payment'),
  totalAnnualPayment: z.number().describe('The total annual payment amount'),
  yearlyBreakdown: yearlyBreakdownSchema.describe(
    'Breakdown of payments by year'
  )
})

export const agreementSchema = z.object({
  agreementNumber: z
    .string()
    .min(1)
    .describe('The unique identifier for the agreement'),
  agreementName: z.string().min(1).describe('The name of the agreement'),
  correlationId: z.string().min(1).describe('The correlation ID for tracking'),
  frn: z.string().min(1).describe('Farm Reference Number'),
  sbi: z.string().min(1).describe('Single Business Identifier'),
  company: z.string().min(1).describe('Company name'),
  address: z.string().min(1).describe('Company address'),
  postcode: z.string().min(1).describe('Company postcode'),
  username: z
    .string()
    .min(1)
    .describe('Username associated with the agreement'),
  agreementStartDate: z.coerce.date().describe('Start date of the agreement'),
  agreementEndDate: z.coerce.date().describe('End date of the agreement'),
  status: z
    .enum(['offered', 'accepted'])
    .default('offered')
    .describe('Current status of the agreement'),
  signatureDate: z.coerce
    .date()
    .optional()
    .describe('Date when agreement was signed'),
  terminationDate: z.coerce
    .date()
    .optional()
    .describe('Date when agreement was terminated'),
  actions: z
    .array(actionSchema)
    .describe('Array of actions associated with the agreement'),
  parcels: z
    .array(parcelSchema)
    .describe('Array of parcels associated with the agreement'),
  payments: paymentsSchema.describe('Payment information for the agreement')
})

export const zodSchema = {
  collection,
  schema: agreementSchema,
  append: {
    actionSchema,
    parcelActivitySchema,
    paymentsActivitySchema,
    parcelSchema,
    yearlyBreakdownSchema,
    paymentsSchema,
    agreementSchema
  }
}

const schema = zodMongooseSchema(agreementSchema, {
  collection,
  timestamps: true
})

// Indexes for common queries
schema.index({ agreementNumber: 1 }, { unique: true })
schema.index({ sbi: 1 })
schema.index({ agreementStartDate: 1 })
schema.index({ agreementEndDate: 1 })

export default mongoose.model(collection, schema)
