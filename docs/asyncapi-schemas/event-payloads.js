import { CLIENT_REF_EXAMPLE } from './constants.js'

export const eventPayloadSchemas = {
  CreateAgreementPayload: {
    type: 'object',
    description:
      'Payload for creating a new agreement from an approved application',
    required: ['type', 'data'],
    properties: {
      type: {
        type: 'string',
        description:
          'Event type identifier. Must contain "gas-backend.agreement.create" to trigger processing.',
        example: 'cloud.defra.dev.fg-gas-backend.agreement.create'
      },
      data: {
        type: 'object',
        description: 'Agreement data from the approved application',
        required: ['identifiers', 'application'],
        properties: {
          correlationId: {
            type: 'string',
            description:
              'Unique identifier for tracing the request across services',
            example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
          },
          clientRef: {
            type: 'string',
            description:
              'Client reference number from the original application',
            example: CLIENT_REF_EXAMPLE
          },
          code: {
            type: 'string',
            description: 'Scheme code identifier',
            example: 'frps-private-beta'
          },
          identifiers: {
            $ref: '#/components/schemas/Identifiers'
          },
          application: {
            $ref: '#/components/schemas/Application'
          },
          applicant: {
            $ref: '#/components/schemas/Applicant'
          },
          payment: {
            $ref: '#/components/schemas/Payment'
          }
        }
      }
    }
  },
  UpdateAgreementPayload: {
    type: 'object',
    description: 'Payload for updating an existing agreement status',
    required: ['data'],
    properties: {
      type: {
        type: 'string',
        description: 'Event type identifier',
        example: 'cloud.defra.dev.fg-gas-backend.application.updated'
      },
      data: {
        type: 'object',
        description: 'Update data for the agreement',
        required: ['clientRef', 'agreementNumber', 'status'],
        properties: {
          clientRef: {
            type: 'string',
            description: 'Client reference number to identify the agreement',
            example: CLIENT_REF_EXAMPLE
          },
          agreementNumber: {
            type: 'string',
            description: 'Unique agreement number',
            example: 'SFI123456789'
          },
          status: {
            type: 'string',
            description:
              'New status for the agreement. Currently only "withdrawn" is processed.',
            enum: ['withdrawn'],
            example: 'withdrawn'
          }
        }
      }
    }
  },
  AgreementStatusUpdatedPayload: {
    type: 'object',
    description:
      'CloudEvents 1.0 formatted payload for agreement status updates',
    required: [
      'id',
      'source',
      'specversion',
      'type',
      'time',
      'datacontenttype',
      'data'
    ],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Unique event identifier (UUID v4)',
        example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      },
      source: {
        type: 'string',
        description: 'Event source URN identifying the Agreement Service',
        example: 'urn:defra:farming:agreement-service'
      },
      specversion: {
        type: 'string',
        description: 'CloudEvents specification version',
        const: '1.0',
        example: '1.0'
      },
      type: {
        type: 'string',
        description: 'CloudEvents type identifier for agreement status updates',
        example: 'cloud.defra.dev.fg-gas-backend.agreement.status.updated'
      },
      time: {
        type: 'string',
        format: 'date-time',
        description: 'ISO 8601 timestamp when the event occurred',
        example: '2025-01-15T10:30:00.000Z'
      },
      datacontenttype: {
        type: 'string',
        description: 'Content type of the data payload',
        const: 'application/json',
        example: 'application/json'
      },
      data: {
        $ref: '#/components/schemas/AgreementStatusData'
      }
    }
  },
  AgreementStatusData: {
    type: 'object',
    description: 'Data payload for agreement status update events',
    required: ['agreementNumber', 'status', 'date'],
    properties: {
      agreementNumber: {
        type: 'string',
        description: 'Unique agreement identifier',
        example: 'SFI123456789'
      },
      correlationId: {
        type: 'string',
        description: 'Correlation ID for request tracing',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      },
      clientRef: {
        type: 'string',
        description: 'Client reference from the original application',
        example: CLIENT_REF_EXAMPLE
      },
      version: {
        type: 'integer',
        description: 'Agreement version number',
        minimum: 1,
        example: 1
      },
      agreementUrl: {
        type: 'string',
        format: 'uri',
        description:
          'URL to view the agreement (only included for accepted agreements)',
        example: 'https://farming-grants.defra.gov.uk/agreement/SFI123456789'
      },
      status: {
        type: 'string',
        description: 'New agreement status',
        enum: ['accepted', 'withdrawn'],
        example: 'accepted'
      },
      date: {
        type: 'string',
        format: 'date-time',
        description: 'ISO 8601 timestamp when the status change occurred',
        example: '2025-01-15T10:30:00.000Z'
      },
      code: {
        type: 'string',
        description: 'Scheme code identifier',
        example: 'frps-private-beta'
      },
      endDate: {
        type: 'string',
        format: 'date',
        description: 'Agreement end date (YYYY-MM-DD)',
        example: '2027-10-31'
      }
    }
  }
}
