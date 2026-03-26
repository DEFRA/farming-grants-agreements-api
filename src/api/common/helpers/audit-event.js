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

/**
 * Builds the full audit payload for an agreement operation.
 * @param {AuditEvent} event
 * @param {{ agreementNumber: string, correlationId?: string }} context
 * @param {'success'|'failure'} status
 */
const buildAuditPayload = (event, context = {}, status = 'success') => ({
  correlationid: context.correlationId,
  datetime: new Date().toISOString(),
  environment: config.get('env'),
  version: '0.1.0',
  application: 'Grants',
  component: config.get('serviceName'),

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
    action: event,
    entity: 'Agreements',
    entityid: context.agreementNumber,
    status,
    details: context
  }
})

/**
 * Records an agreement operation audit event.
 * @param {AuditEvent} event
 * @param {{ agreementNumber: string, correlationId?: string }} context
 * @param {'success'|'failure'} [status]
 */
export const auditEvent = (event, context = {}, status = 'success') => {
  audit(buildAuditPayload(event, context, status))
}
