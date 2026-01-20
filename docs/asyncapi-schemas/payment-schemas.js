import { UNIT_HA, UNIT_METRES } from './constants.js'

export const paymentSchemas = {
  Payment: {
    type: 'object',
    description: 'Payment schedule and calculation details',
    properties: {
      agreementStartDate: {
        type: 'string',
        format: 'date',
        description: 'Agreement start date (YYYY-MM-DD)',
        example: '2024-11-01'
      },
      agreementEndDate: {
        type: 'string',
        format: 'date',
        description: 'Agreement end date (YYYY-MM-DD)',
        example: '2027-10-31'
      },
      frequency: {
        type: 'string',
        description: 'Payment frequency',
        enum: ['Quarterly', 'Annual'],
        example: 'Quarterly'
      },
      agreementTotalPence: {
        type: 'integer',
        description: 'Total agreement value in pence over the full term',
        example: 11270793
      },
      annualTotalPence: {
        type: 'integer',
        description: 'Annual payment total in pence',
        example: 6440448
      },
      parcelItems: {
        type: 'object',
        description: 'Map of parcel-level payment items (keyed by item ID)',
        additionalProperties: {
          $ref: '#/components/schemas/ParcelItem'
        }
      },
      agreementLevelItems: {
        type: 'object',
        description: 'Map of agreement-level payment items (keyed by item ID)',
        additionalProperties: {
          $ref: '#/components/schemas/AgreementLevelItem'
        }
      },
      payments: {
        type: 'array',
        description: 'Scheduled payment instalments',
        items: {
          $ref: '#/components/schemas/PaymentInstalment'
        }
      }
    }
  },
  ParcelItem: {
    type: 'object',
    description: 'Payment line item for a specific parcel action',
    properties: {
      code: {
        type: 'string',
        description: 'Action code',
        example: 'SPM4'
      },
      description: {
        type: 'string',
        description: 'Action description',
        example: 'SPM4: Manage hedgerows'
      },
      version: {
        type: 'integer',
        description: 'Action version',
        example: 1
      },
      unit: {
        type: 'string',
        description: 'Unit of measurement',
        enum: [UNIT_HA, UNIT_METRES],
        example: UNIT_METRES
      },
      quantity: {
        type: 'number',
        description: 'Quantity covered',
        example: 95
      },
      rateInPence: {
        type: 'integer',
        description: 'Payment rate per unit in pence',
        example: 2565
      },
      annualPaymentPence: {
        type: 'integer',
        description: 'Annual payment amount in pence',
        example: 243675
      },
      sheetId: {
        type: 'string',
        description: 'OS map sheet ID',
        example: 'SD4841'
      },
      parcelId: {
        type: 'string',
        description: 'Parcel ID',
        example: '44'
      }
    }
  },
  AgreementLevelItem: {
    type: 'object',
    description: 'Payment line item at agreement level (not parcel-specific)',
    properties: {
      code: {
        type: 'string',
        description: 'Action code',
        example: 'CSAM1'
      },
      description: {
        type: 'string',
        description:
          'CSAM1: Assess soil, produce a soil management plan and test soil organic matter',
        example:
          'CSAM1: Assess soil, produce a soil management plan and test soil organic matter'
      },
      version: {
        type: 'integer',
        description: 'Action version',
        example: 1
      },
      annualPaymentPence: {
        type: 'integer',
        description: 'Annual payment amount in pence',
        example: 27200
      }
    }
  },
  PaymentInstalment: {
    type: 'object',
    description: 'Individual payment instalment',
    properties: {
      totalPaymentPence: {
        type: 'integer',
        description: 'Total payment amount for this instalment in pence',
        example: 1610119
      },
      paymentDate: {
        type: 'string',
        format: 'date',
        description: 'Scheduled payment date (YYYY-MM-DD)',
        example: '2025-12-05'
      },
      lineItems: {
        type: 'array',
        description: 'Breakdown of payment by item',
        items: {
          type: 'object',
          properties: {
            parcelItemId: {
              type: 'integer',
              description:
                'Reference to parcelItems key (mutually exclusive with agreementLevelItemId)',
              example: 1
            },
            agreementLevelItemId: {
              type: 'integer',
              description:
                'Reference to agreementLevelItems key (mutually exclusive with parcelItemId)',
              example: 1
            },
            paymentPence: {
              type: 'integer',
              description: 'Payment amount for this line item in pence',
              example: 60920
            }
          }
        }
      }
    }
  }
}
