import { describe, it, expect } from 'vitest'
import {
  isWmp,
  isWmpAgreement,
  mapWmpPayloadToVersion
} from './wmp-payload-mapper.js'
import wmpFixture from '#~/api/common/helpers/sample-data/wmp-agreement.js'

const fixedUuid = () => '00000000-0000-4000-8000-000000000000'

describe('isWmp', () => {
  it('detects via metadata.clientRef + corroborating answers field', () => {
    expect(isWmp(wmpFixture)).toBe(true)
  })

  it('detects via top-level clientRef when metadata absent', () => {
    expect(
      isWmp({
        clientRef: 'wmp-abc',
        answers: { fcTeamCode: 'X' }
      })
    ).toBe(true)
  })

  it('rejects when clientRef does not start with wmp', () => {
    expect(
      isWmp({
        metadata: { clientRef: 'sfi-123' },
        answers: { appLandHasExistingWmp: false }
      })
    ).toBe(false)
  })

  it('rejects when no corroborating WMP-only answers field present', () => {
    expect(
      isWmp({
        metadata: { clientRef: 'wmp-123' },
        answers: { somethingElse: true }
      })
    ).toBe(false)
  })

  it('rejects null / undefined / non-objects', () => {
    expect(isWmp(null)).toBe(false)
    expect(isWmp(undefined)).toBe(false)
    expect(isWmp('wmp')).toBe(false)
  })
})

describe('isWmpAgreement', () => {
  it('detects via persisted scheme=WMP', () => {
    expect(isWmpAgreement({ scheme: 'WMP', clientRef: 'anything' })).toBe(true)
  })

  it('detects via clientRef prefix when scheme absent', () => {
    expect(isWmpAgreement({ clientRef: 'wmp-2026-1' })).toBe(true)
  })

  it('rejects SFI-shaped agreement', () => {
    expect(isWmpAgreement({ scheme: 'SFI', clientRef: 'sfi-1' })).toBe(false)
  })

  it('rejects null', () => {
    expect(isWmpAgreement(null)).toBe(false)
    expect(isWmpAgreement(undefined)).toBe(false)
  })
})

describe('mapWmpPayloadToVersion', () => {
  const result = mapWmpPayloadToVersion(wmpFixture, {
    notificationMessageId: 'sqs-msg-1',
    correlationId: 'corr-1',
    uuid: fixedUuid
  })

  it('maps top-level fields from the payload', () => {
    expect(result.notificationMessageId).toBe('sqs-msg-1')
    expect(result.correlationId).toBe('corr-1')
    expect(result.clientRef).toBe(wmpFixture.metadata.clientRef)
    expect(result.code).toBe('wmp')
    expect(result.scheme).toBe('WMP')
    expect(result.agreementName).toBe('Woodland Management Plan')
    expect(result.status).toBe('offered')
  })

  it('mirrors identifiers from metadata when top-level identifiers absent', () => {
    expect(result.identifiers).toEqual({
      sbi: '200000001',
      crn: '1200000001',
      frn: '0300000100',
      defraId: undefined
    })
  })

  it('derives agreementStartDate from metadata.submittedAt and endDate +1y', () => {
    expect(result.payment.agreementStartDate).toBe('2026-04-16')
    expect(result.payment.agreementEndDate).toBe('2027-04-16')
  })

  it('sets frequency to OneOff (paid on signature)', () => {
    expect(result.payment.frequency).toBe('OneOff')
  })

  it('copies totals verbatim from the payload', () => {
    expect(result.payment.agreementTotalPence).toBe(166200)
    expect(result.payment.annualTotalPence).toBe(166200)
  })

  it('builds 1-based agreementLevelItems map preserving tier/rate fields', () => {
    expect(result.payment.agreementLevelItems).toEqual({
      1: {
        code: 'PA3',
        description: 'Woodland management plan',
        version: '1',
        annualPaymentPence: 166200,
        quantity: 55.4,
        unit: 'ha',
        activePaymentTier: 2,
        quantityInActiveTier: 5.4,
        activeTierRatePence: 3000,
        activeTierFlatRatePence: 150000
      }
    })
  })

  it('keeps parcelItems empty (WMP payments are agreement-level)', () => {
    expect(result.payment.parcelItems).toEqual({})
  })

  it('emits a single payments[] row with paymentDate=null', () => {
    expect(result.payment.payments).toHaveLength(1)
    const p = result.payment.payments[0]
    expect(p.totalPaymentPence).toBe(166200)
    expect(p.paymentDate).toBeNull()
    expect(p.correlationId).toBe(fixedUuid())
    expect(p.lineItems).toEqual([
      {
        agreementLevelItemId: 1,
        paymentPence: 166200,
        code: 'PA3',
        description: 'Woodland management plan'
      }
    ])
  })

  it('builds application.parcel[] one entry per landParcel', () => {
    expect(result.application.parcel).toHaveLength(2)
    const [p1, p2] = result.application.parcel
    expect(p1.parcelId).toBe('SD7560-9193')
    expect(p1.area).toEqual({ unit: 'ha', quantity: 25.3874 })
    expect(p1.actions).toHaveLength(1)
    expect(p1.actions[0]).toEqual({
      code: 'PA3',
      version: '1',
      durationYears: 1,
      appliedFor: { unit: 'ha', quantity: 25.3874 }
    })
    expect(p2.parcelId).toBe('SD5848-9205')
    expect(p2.area.quantity).toBe(169.8586)
  })

  it('flattens actionApplications[] across parcel × action', () => {
    expect(result.actionApplications).toHaveLength(2)
    expect(result.actionApplications[0]).toEqual({
      code: 'PA3',
      sheetId: 'SD7560-9193',
      parcelId: 'SD7560-9193',
      appliedFor: { unit: 'ha', quantity: 25.3874 }
    })
  })

  it('maps applicant.business + customer.name from answers.applicant', () => {
    expect(result.applicant.business.name).toBe('High Fell Farm')
    expect(result.applicant.business.address.line1).toBe('1 Moorfield')
    expect(result.applicant.business.address.city).toBe('Chesham')
    expect(result.applicant.business.address.postalCode).toBe('SK13 5CB')
    expect(result.applicant.customer.name.first).toBe('Bob')
    expect(result.applicant.customer.name.last).toBe('Sledd')
  })

  it('uses crypto.randomUUID by default when no uuid generator injected', () => {
    const r2 = mapWmpPayloadToVersion(wmpFixture, {
      notificationMessageId: 'm'
    })
    expect(r2.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })
})
