import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { audit } from '@defra/cdp-auditing'
import { config } from '#~/config/index.js'

/**
 * Audit event types.
 * @enum {string}
 */
export const AuditEvent = Object.freeze({
  PDF_DOWNLOADED_FROM_S3: 'PDF_DOWNLOADED_FROM_S3',
  AGREEMENT_CREATED: 'AGREEMENT_CREATED',
  AGREEMENT_UPDATED: 'AGREEMENT_UPDATED'
})

// Human-readable description for each audit event, used in security.details.message
const eventMessages = {
  [AuditEvent.PDF_DOWNLOADED_FROM_S3]:
    'PDF agreement document downloaded from S3',
  [AuditEvent.AGREEMENT_CREATED]: 'Agreement created',
  [AuditEvent.AGREEMENT_UPDATED]: 'Agreement updated'
}

// Transaction code for each audit event, used in security.details.transactioncode
const eventTransactionCodes = {
  [AuditEvent.PDF_DOWNLOADED_FROM_S3]: '2308',
  [AuditEvent.AGREEMENT_CREATED]: '2311',
  [AuditEvent.AGREEMENT_UPDATED]: '2309'
}

// PMC code for each audit event, used in security.pmccode
const eventPmcCodes = {
  [AuditEvent.PDF_DOWNLOADED_FROM_S3]: '0201', // content imported/exported by any user or system component
  [AuditEvent.AGREEMENT_CREATED]: '0704', // record added/created
  [AuditEvent.AGREEMENT_UPDATED]: '0706' // record updated
}

// Audit event type for each audit event, used in audit.eventtype
const eventTypes = {
  [AuditEvent.PDF_DOWNLOADED_FROM_S3]: 'GrantsDownloadAgreement',
  [AuditEvent.AGREEMENT_CREATED]: 'GrantsCreateAgreement',
  [AuditEvent.AGREEMENT_UPDATED]: 'GrantsUpdateAgreement'
}

// Action for each audit event, used in audit.entities[].action
const eventActions = {
  [AuditEvent.PDF_DOWNLOADED_FROM_S3]: 'read',
  [AuditEvent.AGREEMENT_CREATED]: 'created',
  [AuditEvent.AGREEMENT_UPDATED]: 'updated'
}

const snsClient = new SNSClient(
  process.env.NODE_ENV === 'development'
    ? {
        region: config.get('aws.region'),
        endpoint: config.get('aws.sns.endpoint'),
        credentials: {
          accessKeyId: config.get('aws.accessKeyId'),
          secretAccessKey: config.get('aws.secretAccessKey')
        }
      }
    : {}
)

const extractIp = (request) =>
  request?.headers?.['x-forwarded-for']?.split(',')[0].trim() ||
  request?.info?.remoteAddress ||
  ''

/**
 * Builds the full audit payload for an agreement operation.
 * @param {AuditEvent} event
 * @param {{ agreementNumber?: string, correlationId?: string, sbi?: string|number, frn?: string|number, crn?: string|number }} context
 * @param {'success'|'failure'} status
 * @param {string} [ip]
 */
const buildAuditPayload = (
  event,
  context = {},
  status = 'success',
  ip = ''
) => ({
  correlationid: context.correlationId,
  datetime: new Date().toISOString(),
  environment: config.get('env'),
  version: '0.1.0',
  application: 'Grants',
  component: config.get('serviceName'),
  ip,
  security: {
    pmccode: eventPmcCodes[event],
    priority: '0',
    details: {
      transactioncode: eventTransactionCodes[event],
      message: eventMessages[event],
      additionalinfo: `agreementNumber: ${context.agreementNumber}`
    }
  },

  audit: {
    eventtype: eventTypes[event],
    entities: [
      {
        entity: 'agreement',
        action: eventActions[event],
        id: context.agreementNumber
      }
    ],
    accounts: {
      sbi: context.sbi,
      frn: context.frn,
      crn: context.crn
    },
    status,
    details: context
  }
})

/**
 * Records an agreement operation audit event.
 * @param {AuditEvent} event
 * @param {{ agreementNumber?: string, correlationId?: string, sbi?: string|number, frn?: string|number, crn?: string|number }} context
 * @param {'success'|'failure'} [status]
 * @param {object} [request] - Hapi request object, used to extract the originating client IP
 * @param {object} [client] - SNS client, injectable for testing
 */
export const auditEvent = (
  event,
  context = {},
  status = 'success',
  request = null,
  client = snsClient
) => {
  const payload = buildAuditPayload(event, context, status, extractIp(request))

  audit(payload)

  client
    .send(
      new PublishCommand({
        TopicArn: config.get('aws.sns.topic.audit.arn'),
        Message: JSON.stringify(payload)
      })
    )
    .catch(() => {
      // fire and forget — SNS publish failure must not block the caller
    })
}
