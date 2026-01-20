import { UNIT_HA, UNIT_METRES } from './constants.js'

export const applicationSchemas = {
  Application: {
    type: 'object',
    description: 'Application details including land parcels and actions',
    properties: {
      parcel: {
        type: 'array',
        description: 'List of land parcels included in the application',
        items: {
          $ref: '#/components/schemas/Parcel'
        }
      }
    }
  },
  Parcel: {
    type: 'object',
    description: 'Land parcel with associated actions',
    required: ['sheetId', 'parcelId'],
    properties: {
      sheetId: {
        type: 'string',
        description: 'OS map sheet identifier',
        example: 'SD6743'
      },
      parcelId: {
        type: 'string',
        description: 'Land parcel identifier within the sheet',
        example: '8083'
      },
      area: {
        type: 'object',
        description: 'Total area of the parcel',
        properties: {
          unit: {
            type: 'string',
            description: 'Unit of measurement',
            enum: [UNIT_HA, UNIT_METRES],
            example: UNIT_HA
          },
          quantity: {
            type: 'number',
            description: 'Area quantity',
            example: 5.2182
          }
        }
      },
      actions: {
        type: 'array',
        description: 'Environmental actions applied to this parcel',
        items: {
          $ref: '#/components/schemas/Action'
        }
      }
    }
  },
  Action: {
    type: 'object',
    description: 'Environmental action applied to a land parcel',
    required: ['code', 'version', 'appliedFor'],
    properties: {
      code: {
        type: 'string',
        description: 'Action code (e.g., CMOR1, UPL1, SPM4)',
        example: 'CMOR1'
      },
      version: {
        type: 'integer',
        description: 'Action version number',
        example: 1
      },
      durationYears: {
        type: 'integer',
        description: 'Duration of the action in years',
        example: 3
      },
      appliedFor: {
        type: 'object',
        description: 'Quantity applied for this action',
        properties: {
          unit: {
            type: 'string',
            description: 'Unit of measurement',
            enum: [UNIT_HA, UNIT_METRES],
            example: UNIT_HA
          },
          quantity: {
            type: 'number',
            description: 'Quantity applied for',
            example: 4.7575
          }
        }
      }
    }
  }
}
