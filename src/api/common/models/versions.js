import mongoose, { Decimal128 } from 'mongoose'

const collection = 'versions'

const Identifiers = new mongoose.Schema({
  sbi: { type: String, required: true },
  frn: { type: String, required: true },
  crn: { type: String, required: true },
  defraId: { type: String, required: true }
})

const ActionApplications = new mongoose.Schema({
  code: { type: String, required: true },
  parcelId: { type: String, required: true },
  appliedFor: {
    type: new mongoose.Schema({
      unit: { type: String, required: true },
      quantity: { type: Decimal128, required: true }
    }),
    required: true
  }
})

const ParcelItems = new mongoose.Schema({
  code: { type: String, required: true },
  description: { type: String, required: true },
  version: { type: Number, required: true },
  unit: { type: String, required: true },
  quantity: { type: Decimal128, required: true },
  rateInPence: { type: Number, required: true },
  annualPaymentPence: { type: Number, required: true },
  sheetId: { type: String },
  parcelId: { type: String, required: true }
})

const AgreementLevelItems = new mongoose.Schema({
  code: { type: String, required: true },
  description: { type: String, required: true },
  version: { type: Number, required: true },
  annualPaymentPence: { type: Number, required: true }
})

const Payments = new mongoose.Schema({
  totalPaymentPence: { type: Number, required: true },
  paymentDate: { type: String, required: true },
  lineItems: {
    type: [
      new mongoose.Schema({
        parcelItemId: { type: Number },
        agreementLevelItemId: { type: Number },
        paymentPence: { type: Number, required: true }
      })
    ],
    required: true
  }
})

const Payment = new mongoose.Schema({
  agreementStartDate: { type: String, required: true },
  agreementEndDate: { type: String, required: true },
  frequency: { type: String, required: true },
  agreementTotalPence: { type: Number, required: true },
  annualTotalPence: { type: Number, required: true },
  parcelItems: { type: Map, of: ParcelItems, required: true },
  agreementLevelItems: { type: Map, of: AgreementLevelItems, required: true },
  payments: { type: [Payments], required: true }
})

const Applicant = new mongoose.Schema({
  business: {
    type: new mongoose.Schema({
      name: { type: String, required: true },
      email: {
        type: new mongoose.Schema({
          address: { type: String, required: true }
        }),
        required: true
      },
      phone: {
        type: new mongoose.Schema({
          mobile: { type: String }
        }),
        required: true
      },
      address: {
        type: new mongoose.Schema({
          line1: { type: String, required: true },
          line2: { type: String },
          line3: { type: String },
          line4: { type: String },
          line5: { type: String },
          street: { type: String },
          city: { type: String },
          postalCode: { type: String, required: true }
        }),
        required: true
      }
    }),
    required: true
  },
  customer: {
    type: new mongoose.Schema({
      name: {
        type: new mongoose.Schema({
          title: { type: String },
          first: { type: String, required: true },
          middle: { type: String },
          last: { type: String, required: true }
        }),
        required: true
      }
    }),
    required: true
  }
})

const schema = new mongoose.Schema(
  {
    notificationMessageId: { type: String, required: true },
    agreementName: { type: String },
    correlationId: { type: String, required: true },
    clientRef: { type: String, required: true },
    code: { type: String },
    identifiers: { type: Identifiers, required: true },
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
    scheme: { type: String },
    actionApplications: { type: [ActionApplications], required: true },
    payment: { type: Payment, required: true },
    applicant: { type: Applicant, required: true }
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
