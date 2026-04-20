import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mockConfigGet = vi.hoisted(() =>
  vi.fn((key) => {
    const configMap = {
      env: 'test',
      serviceName: 'farming-grants-agreements-api',
      'aws.sns.topic.audit.arn':
        'arn:aws:sns:eu-west-2:000000000000:fcp_audit_farming_grants_agreements_api'
    }
    return configMap[key]
  })
)

vi.mock('#~/config/index.js', () => ({ config: { get: mockConfigGet } }))

const mockSnsClientConstructor = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: mockSnsClientConstructor,
  PublishCommand: vi.fn()
}))

describe('AuditEvent', () => {
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    mockSnsClientConstructor.mockImplementation(function () {
      return { send: vi.fn().mockResolvedValue({}) }
    })
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
  let mockSnsClient

  beforeEach(async () => {
    vi.resetModules()
    mockSnsClient = { send: vi.fn().mockResolvedValue({}) }
    mockSnsClientConstructor.mockImplementation(function () {
      return mockSnsClient
    })
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

    auditEvent(
      AuditEvent.PDF_DOWNLOADED_FROM_S3,
      context,
      'success',
      mockSnsClient
    )

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
    auditEvent(
      AuditEvent.PDF_DOWNLOADED_FROM_S3,
      { agreementNumber: 'FPTT123456789' },
      'success',
      mockSnsClient
    )

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

    auditEvent(
      AuditEvent.PDF_DOWNLOADED_FROM_S3,
      context,
      'success',
      mockSnsClient
    )

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          eventtype: 'GrantsDownloadAgreement',
          entities: [
            { entity: 'agreement', action: 'read', id: 'FPTT123456789' }
          ],
          accounts: { sbi: undefined, frn: undefined, crn: undefined },
          status: 'success',
          details: context
        })
      })
    )
  })

  test('includes accounts when sbi/frn/crn are provided in context', () => {
    const context = {
      agreementNumber: 'FPTT123456789',
      sbi: 123456789,
      frn: 9876543210,
      crn: 'CRN001'
    }

    auditEvent(
      AuditEvent.PDF_DOWNLOADED_FROM_S3,
      context,
      'success',
      mockSnsClient
    )

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          accounts: { sbi: 123456789, frn: 9876543210, crn: 'CRN001' }
        })
      })
    )
  })

  test('passes failure status through to the audit payload', () => {
    auditEvent(AuditEvent.PDF_DOWNLOADED_FROM_S3, {}, 'failure', mockSnsClient)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({ status: 'failure' })
      })
    )
  })

  test('handles empty context gracefully', () => {
    auditEvent(
      AuditEvent.PDF_DOWNLOADED_FROM_S3,
      undefined,
      'success',
      mockSnsClient
    )

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationid: undefined,
        audit: expect.objectContaining({
          entities: [{ entity: 'agreement', action: 'read', id: undefined }]
        })
      })
    )
  })

  test('publishes audit payload to SNS topic', () => {
    const context = {
      agreementNumber: 'FPTT123456789',
      correlationId: 'corr-xyz'
    }

    auditEvent(
      AuditEvent.PDF_DOWNLOADED_FROM_S3,
      context,
      'success',
      mockSnsClient
    )

    expect(mockSnsClient.send).toHaveBeenCalledWith(expect.any(Object))
  })

  test('does not throw when SNS publish fails', () => {
    mockSnsClient.send.mockRejectedValueOnce(new Error('SNS error'))

    expect(() =>
      auditEvent(
        AuditEvent.PDF_DOWNLOADED_FROM_S3,
        { agreementNumber: 'FPTT123456789' },
        'success',
        mockSnsClient
      )
    ).not.toThrow()
  })
})

describe('auditEvent - AGREEMENT_CREATED', () => {
  let audit
  let auditEvent
  let AuditEvent
  let mockSnsClient

  beforeEach(async () => {
    vi.resetModules()
    mockSnsClient = { send: vi.fn().mockResolvedValue({}) }
    mockSnsClientConstructor.mockImplementation(function () {
      return mockSnsClient
    })
    vi.doMock('@defra/cdp-auditing', () => ({ audit: vi.fn() }))
    ;({ auditEvent, AuditEvent } = await import('./audit-event.js'))
    ;({ audit } = await import('@defra/cdp-auditing'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('calls audit with correct security fields', () => {
    auditEvent(
      AuditEvent.AGREEMENT_CREATED,
      { agreementNumber: 'FPTT123456789' },
      'success',
      mockSnsClient
    )

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

    auditEvent(AuditEvent.AGREEMENT_CREATED, context, 'success', mockSnsClient)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          eventtype: 'GrantsCreateAgreement',
          entities: [
            { entity: 'agreement', action: 'created', id: 'FPTT123456789' }
          ],
          accounts: { sbi: undefined, frn: undefined, crn: undefined },
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
  let mockSnsClient

  beforeEach(async () => {
    vi.resetModules()
    mockSnsClient = { send: vi.fn().mockResolvedValue({}) }
    mockSnsClientConstructor.mockImplementation(function () {
      return mockSnsClient
    })
    vi.doMock('@defra/cdp-auditing', () => ({ audit: vi.fn() }))
    ;({ auditEvent, AuditEvent } = await import('./audit-event.js'))
    ;({ audit } = await import('@defra/cdp-auditing'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('calls audit with correct security fields', () => {
    auditEvent(
      AuditEvent.AGREEMENT_UPDATED,
      { agreementNumber: 'FPTT123456789' },
      'success',
      mockSnsClient
    )

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

    auditEvent(AuditEvent.AGREEMENT_UPDATED, context, 'success', mockSnsClient)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          eventtype: 'GrantsUpdateAgreement',
          entities: [
            { entity: 'agreement', action: 'updated', id: 'FPTT123456789' }
          ],
          accounts: { sbi: undefined, frn: undefined, crn: undefined },
          status: 'success',
          details: context
        })
      })
    )
  })
})
