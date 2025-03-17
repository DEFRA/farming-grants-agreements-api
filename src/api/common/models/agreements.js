import mongoose from 'mongoose'

const collection = 'agreements'

const actionSchema = new mongoose.Schema({
  code: { type: String, required: true },
  title: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  duration: { type: String, required: true }
})

const activitySchema = new mongoose.Schema({
  code: { type: String, required: true },
  description: { type: String, required: true },
  area: { type: Number, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true }
})

const parcelSchema = new mongoose.Schema({
  parcelNumber: { type: String, required: true },
  parcelName: { type: String, default: '' },
  totalArea: { type: Number, required: true },
  activities: { type: [activitySchema], default: [] }
})

const yearlyBreakdownSchema = new mongoose.Schema({
  details: { type: [Object], default: [] },
  annualTotals: {
    year1: { type: Number, required: true },
    year2: { type: Number, required: true },
    year3: { type: Number, required: true }
  },
  totalAgreementPayment: { type: Number, required: true }
})

const paymentsSchema = new mongoose.Schema({
  activities: { type: [Object], default: [] },
  totalAnnualPayment: { type: Number, required: true },
  yearlyBreakdown: { type: yearlyBreakdownSchema, required: true }
})

const schema = new mongoose.Schema(
  {
    agreementNumber: { type: String, required: true },
    agreementName: { type: String, required: true },
    sbi: { type: String, required: true },
    company: { type: String, required: true },
    address: { type: String, required: true },
    postcode: { type: String, required: true },
    username: { type: String, required: true },
    agreementStartDate: { type: String, required: true },
    agreementEndDate: { type: String, required: true },
    signatureDate: { type: String, required: true },
    actions: { type: [actionSchema], required: true },
    parcels: { type: [parcelSchema], required: true },
    payments: { type: paymentsSchema, required: true }
  },
  {
    collection,
    timestamps: true
  }
)

// Indexes for common queries
schema.index({ agreementNumber: 1 }, { unique: true })
schema.index({ sbi: 1 })
schema.index({ agreementStartDate: 1 })
schema.index({ agreementEndDate: 1 })

export default mongoose.model(collection, schema)
