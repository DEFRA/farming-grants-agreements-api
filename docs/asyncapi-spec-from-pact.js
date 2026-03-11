/**
 * AsyncAPI specification for Agreement Service events (refactored to use Pact test data)
 * Defines SQS consumers and SNS publishers for event-driven messaging
 *
 * This version derives schemas from the actual Pact contract test data,
 * eliminating duplication between test fixtures and documentation.
 */

import {
  getIdentifiersSchema,
  getApplicationSchemas,
  getPaymentSchemas,
  getApplicantSchemas,
  getEventPayloadExamples
} from './asyncapi-schemas/schema-from-pact.js'

// Get schemas generated from Pact test sample data
const identifiersSchema = getIdentifiersSchema()
const { Application, Parcel, Action } = getApplicationSchemas()
const { Payment } = getPaymentSchemas()
const { Applicant, Address } = getApplicantSchemas()
const examples = getEventPayloadExamples()

export const asyncApiSpec = {
  asyncapi: '2.6.0',
  info: {
    title: 'Agreement Service Events',
    version: '1.0.0',
    description:
      'Event-driven messaging for the Farming Grants Agreements API. This service consumes agreement creation and update events from SQS queues, and publishes agreement status change notifications to SNS topics. Schemas are generated from Pact contract test data.'
  },
  channels: {
    'sqs/gas_create_agreement': {
      description:
        'Queue for creating new agreements from the Grant Application Service (GAS). When a grant application is approved, GAS publishes a message to this queue to trigger agreement creation.',
      subscribe: {
        operationId: 'handleCreateAgreementEvent',
        summary: 'Handle agreement creation from approved applications',
        message: {
          name: 'CreateAgreementEvent',
          title: 'Create Agreement Event',
          summary:
            'Event triggered when a grant application is approved and an agreement should be created',
          contentType: 'application/json',
          payload: {
            $ref: '#/components/schemas/CreateAgreementPayload'
          },
          examples: [
            {
              name: 'Agreement Created Example (from Pact tests)',
              payload: examples.createAgreement
            }
          ]
        }
      }
    },
    'sqs/gas_application_updated': {
      description:
        'Queue for application status updates from GAS. Currently handles withdrawal events to update agreement status accordingly.',
      subscribe: {
        operationId: 'handleUpdateAgreementEvent',
        summary: 'Handle application status updates (e.g., withdrawn)',
        message: {
          name: 'UpdateAgreementEvent',
          title: 'Update Agreement Event',
          summary:
            'Event triggered when an application status changes (e.g., withdrawn)',
          contentType: 'application/json',
          payload: {
            $ref: '#/components/schemas/UpdateAgreementPayload'
          },
          examples: [
            {
              name: 'Agreement Withdrawn Example (from Pact tests)',
              payload: examples.updateAgreement
            }
          ]
        }
      }
    },
    'sns/agreement_status_updated': {
      description:
        'SNS topic for agreement status change notifications. Published when an agreement is accepted by the farmer or withdrawn. Consumers include GAS and other downstream services.',
      publish: {
        operationId: 'publishAgreementStatusUpdated',
        summary: 'Publish agreement status change notification',
        message: {
          name: 'AgreementStatusUpdatedEvent',
          title: 'Agreement Status Updated Event',
          summary:
            'CloudEvents 1.0 formatted notification when agreement status changes',
          contentType: 'application/json',
          payload: {
            $ref: '#/components/schemas/AgreementStatusUpdatedPayload'
          },
          examples: [
            {
              name: 'Agreement Status Updated Example',
              payload: examples.agreementStatusUpdated
            }
          ]
        }
      }
    }
  },
  components: {
    schemas: {
      // Event payload schemas (manually defined CloudEvents wrappers)
      CreateAgreementPayload: {
        type: 'object',
        description:
          'CloudEvents 1.0 payload for creating a new agreement from an approved application',
        required: ['type', 'data'],
        properties: {
          id: {
            type: 'string',
            description: 'Unique event identifier (UUID)'
          },
          source: {
            type: 'string',
            description: 'Event source identifier',
            example: 'fg-gas-backend'
          },
          time: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 timestamp'
          },
          specversion: {
            type: 'string',
            const: '1.0',
            description: 'CloudEvents specification version'
          },
          type: {
            type: 'string',
            description:
              'Event type identifier. Must contain "gas-backend.agreement.create"',
            example: 'cloud.defra.test.fg-gas-backend.agreement.create'
          },
          datacontenttype: {
            type: 'string',
            const: 'application/json'
          },
          data: {
            $ref: '#/components/schemas/AgreementData'
          }
        }
      },
      UpdateAgreementPayload: {
        type: 'object',
        description: 'CloudEvents 1.0 payload for updating agreement status',
        required: ['data'],
        properties: {
          id: {
            type: 'string',
            description: 'Unique event identifier (UUID)'
          },
          source: {
            type: 'string',
            description: 'Event source identifier'
          },
          specversion: {
            type: 'string',
            const: '1.0'
          },
          type: {
            type: 'string',
            description: 'Event type identifier',
            example: 'cloud.defra.test.fg-gas-backend.agreement.withdraw'
          },
          datacontenttype: {
            type: 'string',
            const: 'application/json'
          },
          data: {
            type: 'object',
            required: ['clientRef', 'agreementNumber', 'status'],
            properties: {
              clientRef: {
                type: 'string',
                description: 'Client reference number'
              },
              agreementNumber: {
                type: 'string',
                description: 'Agreement number'
              },
              status: {
                type: 'string',
                enum: ['withdrawn'],
                description: 'New status'
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
            description: 'Unique event identifier (UUID v4)'
          },
          source: {
            type: 'string',
            description: 'Event source URN',
            example: 'urn:defra:farming:agreement-service'
          },
          specversion: {
            type: 'string',
            const: '1.0'
          },
          type: {
            type: 'string',
            description: 'CloudEvents type identifier',
            example: 'cloud.defra.dev.fg-gas-backend.agreement.status.updated'
          },
          time: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 timestamp'
          },
          datacontenttype: {
            type: 'string',
            const: 'application/json'
          },
          data: {
            type: 'object',
            required: ['agreementNumber', 'status', 'date'],
            properties: {
              agreementNumber: { type: 'string' },
              correlationId: { type: 'string' },
              clientRef: { type: 'string' },
              version: { type: 'integer', minimum: 1 },
              agreementUrl: { type: 'string', format: 'uri' },
              status: {
                type: 'string',
                enum: ['accepted', 'withdrawn']
              },
              date: { type: 'string', format: 'date-time' },
              code: { type: 'string' },
              endDate: { type: 'string', format: 'date' }
            }
          }
        }
      },

      // Core agreement data schema generated from Pact test data
      AgreementData: {
        type: 'object',
        description:
          'Complete agreement data structure (generated from Pact test sample data)',
        properties: {
          notificationMessageId: { type: 'string' },
          agreementNumber: { type: 'string' },
          clientRef: { type: 'string' },
          code: { type: 'string' },
          identifiers: { $ref: '#/components/schemas/Identifiers' },
          answers: {
            type: 'object',
            properties: {
              agreementName: { type: 'string' },
              actionApplications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    sheetId: { type: 'string' },
                    parcelId: { type: 'string' },
                    code: { type: 'string' },
                    appliedFor: {
                      type: 'object',
                      properties: {
                        quantity: { type: 'number' },
                        unit: { type: 'string', enum: ['ha', 'metres'] }
                      }
                    }
                  }
                }
              }
            }
          },
          applicant: { $ref: '#/components/schemas/Applicant' },
          payment: { $ref: '#/components/schemas/Payment' }
        }
      },

      // Domain schemas generated from Pact test data
      Identifiers: identifiersSchema,
      Application,
      Parcel,
      Action,
      Payment,
      Applicant,
      Address
    }
  }
}
