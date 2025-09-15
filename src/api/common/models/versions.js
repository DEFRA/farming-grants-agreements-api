import mongoose from 'mongoose'

const collection = 'versions'

const actionSchema = new mongoose.Schema({
  code: { type: String, required: true },
  title: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  duration: { type: String, required: true }
})

const parcelActivitySchema = new mongoose.Schema({
  code: { type: String, required: true },
  description: { type: String, default: '' },
  area: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true }
})

const paymentsActivitySchema = new mongoose.Schema({
  code: { type: String, required: true },
  description: { type: String, default: '' },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  measurement: { type: String, required: true },
  paymentRate: { type: String, required: true },
  annualPayment: { type: Number, required: true }
})

const parcelSchema = new mongoose.Schema({
  parcelNumber: { type: String, required: true },
  parcelName: { type: String, default: '' },
  totalArea: { type: Number, required: true },
  activities: { type: [parcelActivitySchema], default: [] }
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
  activities: { type: [paymentsActivitySchema], default: [] },
  totalAnnualPayment: { type: Number, required: true },
  yearlyBreakdown: { type: yearlyBreakdownSchema, required: true }
})

const schema = new mongoose.Schema(
  {
    notificationMessageId: { type: String, required: true },
    agreementName: { type: String, required: true },
    correlationId: { type: String, required: true },
    clientRef: { type: String, required: true },
    frn: { type: String, required: true },
    sbi: { type: String, required: true },
    company: { type: String, required: true },
    address: { type: String, required: true },
    postcode: { type: String, required: true },
    username: { type: String, required: true },
    agreementStartDate: { type: Date, required: true },
    agreementEndDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      default: 'offered',
      enum: ['offered', 'accepted']
    },
    agreement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'agreements',
      default: null,
      index: true
    },
    signatureDate: { type: Date },
    terminationDate: { type: Date },
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
schema.index({ notificationMessageId: 1 }, { unique: true })
schema.index({ sbi: 1 })
schema.index({ agreementStartDate: 1 })
schema.index({ agreementEndDate: 1 })
schema.index({ agreement: 1, createdAt: -1, _id: -1 })

export default mongoose.model(collection, schema)
