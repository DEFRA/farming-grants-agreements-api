import { audit } from '@defra/cdp-auditing'
import { config } from '#~/config/index.js'

export const AuditEvent = Object.freeze({
  PDF_DOWNLOADED_FROM_S3: 'PDF_DOWNLOADED_FROM_S3'
})

// Human-readable description for each audit event, used in security.details.message
const eventMessages = {
  [AuditEvent.PDF_DOWNLOADED_FROM_S3]: 'PDF document downloaded from S3'
}

// Transaction code for each audit event, used in security.details.transactioncode
const eventTransactionCodes = {
  [AuditEvent.PDF_DOWNLOADED_FROM_S3]: '2308'
}

/**
 * Builds the full audit payload for a PDF S3 operation.
 *
 * @param {AuditEvent[keyof AuditEvent]} event
 * @param {{ agreementNumber: string, version: string|number, key: string, bucket: string, correlationId?: string }} context
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
    pmccode: '0201', // logs must record when content is imported (uploaded) or exported (downloaded) by any user (internal or external) or system component.
    priority: '0',
    details: {
      transactioncode: eventTransactionCodes[event],
      message: eventMessages[event],
      additionalinfo: `agreementNumber: ${context.agreementNumber}`
    }
  },

  audit: {
    eventtype: 'GrantsDownloadAgreement',
    action: event,
    entity: 'Agreements',
    entityid: context.agreementNumber,
    status,
    details: context
  }
})

/**
 * Records a PDF S3 operation audit event.
 * @param {AuditEvent[keyof AuditEvent]} event
 * @param {{ agreementNumber: string, version: string|number, key: string, bucket: string, correlationId?: string }} context
 * @param {'success'|'failure'} [status]
 */
export const auditEvent = (event, context = {}, status = 'success') => {
  audit(buildAuditPayload(event, context, status))
}
