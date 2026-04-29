import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { networkInterfaces } from 'node:os'
import { audit } from '@defra/cdp-auditing'
import { config } from '#~/config/index.js'

/**
 * Sentinel audit schema constraint: `ip` must be present and at most 20
 * characters long (covers IPv4 and standard IPv6, but not multi-IP strings).
 */
const MAX_IP_LENGTH = 20

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

/**
 * Resolves and caches this service's own non-internal IPv4 address, used as
 * the audit `ip` for events that originate from scheduled tasks / SQS message
 * processors where there is no inbound HTTP request to attribute.
 * Falls back to `127.0.0.1` if no external interface is found, so the audit
 * payload always satisfies the mandatory `ip` field.
 * @returns {string}
 */
let cachedServiceIp = null
const getServiceIp = () => {
  if (cachedServiceIp) {
    return cachedServiceIp
  }
  try {
    const interfaces = networkInterfaces()
    for (const addrs of Object.values(interfaces)) {
      for (const addr of addrs ?? []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          cachedServiceIp = addr.address
          return cachedServiceIp
        }
      }
    }
  } catch {
    // ignore — fall through to loopback default
  }
  cachedServiceIp = '127.0.0.1'
  return cachedServiceIp
}

/**
 * Normalises a raw IP string to a single, schema-compliant address.
 *  - keeps only the first entry of an `x-forwarded-for` style list
 *  - strips a trailing `:port` from IPv4 (`1.2.3.4:5678` → `1.2.3.4`)
 *  - strips an IPv6 zone id (`fe80::1%eth0` → `fe80::1`)
 *  - returns `''` if the result is still longer than 20 chars (caller falls back)
 * @param {string} raw
 * @returns {string}
 */
const sanitiseIp = (raw) => {
  if (!raw || typeof raw !== 'string') {
    return ''
  }
  let ip = raw.split(',')[0].trim()
  // strip IPv6 zone id
  ip = ip.split('%')[0]
  // strip :port from IPv4 (an IPv6 address contains multiple colons, leave it alone)
  if ((ip.match(/:/g) ?? []).length === 1) {
    ip = ip.split(':')[0]
  }
  if (ip.length === 0 || ip.length > MAX_IP_LENGTH) {
    return ''
  }
  return ip
}

/**
 * Resolve the IP to record on the audit event.
 *  - If an inbound Hapi request is provided, prefer the first
 *    `x-forwarded-for` entry, then `request.info.remoteAddress`.
 *  - If neither yields a usable single IP within the 20-char limit, or no
 *    request is provided (e.g. SQS / scheduled task), fall back to this
 *    service's own IP so the mandatory `ip` field is always populated.
 * @param {object} [request]
 * @returns {string}
 */
const extractIp = (request) => {
  const forwarded = sanitiseIp(request?.headers?.['x-forwarded-for'])
  if (forwarded) {
    return forwarded
  }
  const remote = sanitiseIp(request?.info?.remoteAddress)
  if (remote) {
    return remote
  }
  return getServiceIp()
}

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
  environment: config.get('cdpEnvironment'),
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
      sbi: context.identifiers?.sbi,
      frn: context.identifiers?.frn,
      crn: context.identifiers?.crn
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
