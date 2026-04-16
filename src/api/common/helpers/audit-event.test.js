import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mockConfigGet = vi.hoisted(() =>
  vi.fn((key) => {
    const configMap = {
      env: 'test',
      serviceName: 'farming-grants-agreements-api'
    }
    return configMap[key]
  })
)

vi.mock('#~/config/index.js', () => ({ config: { get: mockConfigGet } }))

describe('AuditEvent', () => {
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('@defra/cdp-auditing', () => ({ audit: vi.fn() }))
    ;({ AuditEvent } = await import('./audit-event.js'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('is frozen', () => {
    expect(Object.isFrozen(AuditEvent)).toBe(true)
  })

  test('contains expected event keys', () => {
    expect(AuditEvent.PDF_DOWNLOADED_FROM_S3).toBe('PDF_DOWNLOADED_FROM_S3')
    expect(AuditEvent.AGREEMENT_CREATED).toBe('AGREEMENT_CREATED')
    expect(AuditEvent.AGREEMENT_UPDATED).toBe('AGREEMENT_UPDATED')
  })

  test('cannot be mutated', () => {
    expect(() => {
      AuditEvent.NEW_KEY = 'value'
    }).toThrow(TypeError)
    expect(AuditEvent.NEW_KEY).toBeUndefined()
  })
})

describe('auditEvent - PDF_DOWNLOADED_FROM_S3', () => {
  let audit
  let auditEvent
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('@defra/cdp-auditing', () => ({ audit: vi.fn() }))
    ;({ auditEvent, AuditEvent } = await import('./audit-event.js'))
    ;({ audit } = await import('@defra/cdp-auditing'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('calls audit with correct top-level fields for download', () => {
    const context = {
      agreementNumber: 'FPTT123456789',
      version: '1',
      key: 'base/FPTT123456789/1/FPTT123456789-1.pdf',
      bucket: 'test-bucket',
      correlationId: 'corr-xyz'
    }

    auditEvent(AuditEvent.PDF_DOWNLOADED_FROM_S3, context)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationid: 'corr-xyz',
        datetime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        environment: 'test',
        application: 'Grants',
        component: 'farming-grants-agreements-api'
      })
    )
  })

  test('calls audit with correct security fields', () => {
    auditEvent(AuditEvent.PDF_DOWNLOADED_FROM_S3, {
      agreementNumber: 'FPTT123456789'
    })

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        security: expect.objectContaining({
          pmccode: '0201',
          details: expect.objectContaining({
            transactioncode: '2308',
            message: 'PDF agreement document downloaded from S3',
            additionalinfo: 'agreementNumber: FPTT123456789'
          })
        })
      })
    )
  })

  test('calls audit with correct audit fields for download', () => {
    const context = {
      agreementNumber: 'FPTT123456789',
      version: '1',
      key: 'base/FPTT123456789/1/FPTT123456789-1.pdf',
      bucket: 'test-bucket',
      correlationId: 'corr-xyz'
    }

    auditEvent(AuditEvent.PDF_DOWNLOADED_FROM_S3, context)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          eventtype: 'GrantsDownloadAgreement',
          action: 'read',
          entity: 'agreement',
          entityid: 'FPTT123456789',
          status: 'success',
          details: context
        })
      })
    )
  })

  test('passes failure status through to the audit payload', () => {
    auditEvent(AuditEvent.PDF_DOWNLOADED_FROM_S3, {}, 'failure')

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({ status: 'failure' })
      })
    )
  })

  test('handles empty context gracefully', () => {
    auditEvent(AuditEvent.PDF_DOWNLOADED_FROM_S3)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationid: undefined,
        audit: expect.objectContaining({ entityid: undefined })
      })
    )
  })
})

describe('auditEvent - AGREEMENT_CREATED', () => {
  let audit
  let auditEvent
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('@defra/cdp-auditing', () => ({ audit: vi.fn() }))
    ;({ auditEvent, AuditEvent } = await import('./audit-event.js'))
    ;({ audit } = await import('@defra/cdp-auditing'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('calls audit with correct security fields', () => {
    auditEvent(AuditEvent.AGREEMENT_CREATED, {
      agreementNumber: 'FPTT123456789'
    })

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        security: expect.objectContaining({
          pmccode: '0704',
          details: expect.objectContaining({
            transactioncode: '2311',
            message: 'Agreement created',
            additionalinfo: 'agreementNumber: FPTT123456789'
          })
        })
      })
    )
  })

  test('calls audit with correct audit fields for agreement created', () => {
    const context = {
      agreementNumber: 'FPTT123456789',
      correlationId: 'corr-xyz'
    }

    auditEvent(AuditEvent.AGREEMENT_CREATED, context)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          eventtype: 'GrantsCreateAgreement',
          action: 'created',
          entity: 'agreement',
          entityid: 'FPTT123456789',
          status: 'success',
          details: context
        })
      })
    )
  })
})

describe('auditEvent - AGREEMENT_UPDATED', () => {
  let audit
  let auditEvent
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('@defra/cdp-auditing', () => ({ audit: vi.fn() }))
    ;({ auditEvent, AuditEvent } = await import('./audit-event.js'))
    ;({ audit } = await import('@defra/cdp-auditing'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('calls audit with correct security fields', () => {
    auditEvent(AuditEvent.AGREEMENT_UPDATED, {
      agreementNumber: 'FPTT123456789'
    })

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        security: expect.objectContaining({
          pmccode: '0706',
          details: expect.objectContaining({
            transactioncode: '2309',
            message: 'Agreement updated',
            additionalinfo: 'agreementNumber: FPTT123456789'
          })
        })
      })
    )
  })

  test('calls audit with correct audit fields for agreement update', () => {
    const context = {
      agreementNumber: 'FPTT123456789',
      correlationId: 'corr-xyz'
    }

    auditEvent(AuditEvent.AGREEMENT_UPDATED, context)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          eventtype: 'GrantsUpdateAgreement',
          action: 'updated',
          entity: 'agreement',
          entityid: 'FPTT123456789',
          status: 'success',
          details: context
        })
      })
    )
  })
})
