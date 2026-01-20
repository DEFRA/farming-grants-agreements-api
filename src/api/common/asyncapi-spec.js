/**
 * AsyncAPI specification for Agreement Service events
 * Defines SQS consumers and SNS publishers for event-driven messaging
 */

import { eventPayloadSchemas } from './asyncapi-schemas/event-payloads.js'
import { commonSchemas } from './asyncapi-schemas/common-schemas.js'
import { applicationSchemas } from './asyncapi-schemas/application-schemas.js'
import { paymentSchemas } from './asyncapi-schemas/payment-schemas.js'
import { applicantSchemas } from './asyncapi-schemas/applicant-schemas.js'

export const asyncApiSpec = {
  asyncapi: '2.6.0',
  info: {
    title: 'Agreement Service Events',
    version: '1.0.0',
    description:
      'Event-driven messaging for the Farming Grants Agreements API. This service consumes agreement creation and update events from SQS queues, and publishes agreement status change notifications to SNS topics.'
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
          }
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
          }
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
          }
        }
      }
    }
  },
  components: {
    schemas: {
      ...eventPayloadSchemas,
      ...commonSchemas,
      ...applicationSchemas,
      ...paymentSchemas,
      ...applicantSchemas
    }
  }
}
