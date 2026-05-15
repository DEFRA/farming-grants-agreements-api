import { describe, it, expect } from 'vitest'
import { mapWmpPayloadToVersion } from './wmp-payload-mapper.js'
import wmpFixture from '#~/api/common/helpers/sample-data/wmp-agreement.js'

const fixedUuid = () => '00000000-0000-4000-8000-000000000000'

describe('mapWmpPayloadToVersion', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const result = mapWmpPayloadToVersion(wmpFixture, {
    notificationMessageId: 'sqs-msg-1',
    correlationId: 'corr-1',
    uuid: fixedUuid
  })

  it('maps top-level fields from the payload', () => {
    expect(result.notificationMessageId).toBe('sqs-msg-1')
    expect(result.correlationId).toBe('corr-1')
    expect(result.clientRef).toBe(wmpFixture.clientRef)
    expect(result.code).toBe('woodland')
    expect(result.scheme).toBe('WMP')
    expect(result.agreementName).toBe('Woodland Management Plan')
    expect(result.status).toBe('offered')
  })

  it('takes identifiers from top-level identifiers', () => {
    expect(result.identifiers).toEqual({
      sbi: '107593059',
      crn: '1100957269',
      frn: '1076543210',
      defraId: undefined
    })
  })

  it('builds a OneOff payment subdoc from answers.payments.agreement[]', () => {
    expect(result.payment).not.toBeNull()
    expect(result.payment.frequency).toBe('OneOff')
    expect(result.payment.agreementTotalPence).toBe(166200)
    expect(result.payment.annualTotalPence).toBe(166200)
    expect(result.payment.parcelItems).toEqual({})
    expect(result.payment.agreementLevelItems).toEqual({
      1: {
        code: 'PA3',
        description: 'Woodland management plan',
        version: '1',
        annualPaymentPence: 166200
      }
    })
    expect(result.payment.payments).toEqual([
      {
        totalPaymentPence: 166200,
        paymentDate: null,
        correlationId: fixedUuid(),
        lineItems: [
          {
            agreementLevelItemId: 1,
            paymentPence: 166200,
            code: 'PA3',
            description: 'Woodland management plan'
          }
        ]
      }
    ])
  })

  it('derives agreementStartDate / endDate from detailsConfirmedAt', () => {
    expect(result.payment.agreementStartDate).toBe('2026-04-02')
    expect(result.payment.agreementEndDate).toBe('2027-04-02')
  })

  it('persists payment as null when payments are absent', () => {
    const noPay = {
      ...wmpFixture,
      answers: {
        ...wmpFixture.answers,
        payments: undefined,
        totalAgreementPaymentPence: undefined
      }
    }
    const v = mapWmpPayloadToVersion(noPay, { notificationMessageId: 'm' })
    expect(v.payment).toBeNull()
  })

  it('builds application.parcel[] one entry per landParcel', () => {
    expect(result.application.parcel).toHaveLength(2)
    const [p1, p2] = result.application.parcel
    expect(p1.parcelId).toBe('SD7560-9193')
    expect(p1.area).toEqual({ unit: 'ha', quantity: 25.3874 })
    expect(p1.actions).toEqual([
      {
        code: 'PA3',
        version: '1',
        durationYears: 1,
        appliedFor: { unit: 'ha', quantity: 55.4 }
      }
    ])
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

  it('emits empty actionApplications and parcel arrays when landParcels absent', () => {
    const noParcels = {
      ...wmpFixture,
      answers: { ...wmpFixture.answers, landParcels: undefined }
    }
    const v = mapWmpPayloadToVersion(noParcels, { notificationMessageId: 'm' })
    expect(v.actionApplications).toEqual([])
    expect(v.application.parcel).toEqual([])
  })

  it('maps applicant.business + customer.name from answers.applicant', () => {
    expect(result.applicant.business.name).toBe('Taylor Equestrian Yards')
    expect(result.applicant.business.address.line1).toBe(
      'Taylor Equestrian Yards'
    )
    expect(result.applicant.business.address.city).toBe('Cambridge')
    expect(result.applicant.business.address.postalCode).toBe('CB1 2AB')
    expect(result.applicant.customer.name.first).toBe('Oliver')
    expect(result.applicant.customer.name.last).toBe('Taylor')
  })

  it('normalises optional applicant address and customer name fields', () => {
    const payload = {
      ...wmpFixture,
      answers: {
        ...wmpFixture.answers,
        applicant: {
          ...wmpFixture.answers.applicant,
          business: {
            ...wmpFixture.answers.applicant.business,
            address: {
              ...wmpFixture.answers.applicant.business.address,
              line2: undefined,
              line3: 'Building 3',
              line4: 'North Estate',
              line5: 'Upper Valley',
              street: undefined
            }
          },
          customer: {
            ...wmpFixture.answers.applicant.customer,
            name: {
              ...wmpFixture.answers.applicant.customer.name,
              title: undefined,
              middle: undefined
            }
          }
        }
      }
    }

    const v = mapWmpPayloadToVersion(payload, {
      notificationMessageId: 'm',
      uuid: fixedUuid
    })

    expect(v.applicant.business.address).toEqual({
      line1: 'Taylor Equestrian Yards',
      line2: undefined,
      line3: 'Building 3',
      line4: 'North Estate',
      line5: 'Upper Valley',
      street: undefined,
      city: 'Cambridge',
      postalCode: 'CB1 2AB'
    })
    expect(v.applicant.customer.name.title).toBeUndefined()
    expect(v.applicant.customer.name.middle).toBeUndefined()
  })

  it('uses crypto.randomUUID by default when no uuid generator injected', () => {
    const r2 = mapWmpPayloadToVersion(wmpFixture, {
      notificationMessageId: 'm'
    })
    expect(r2.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })

  it('falls back to metadata.* identifiers if top-level identifiers absent', () => {
    const legacyShape = {
      ...wmpFixture,
      identifiers: undefined,
      metadata: {
        sbi: '107593059',
        crn: '1100957269',
        frn: '1076543210',
        clientRef: 'wmp-legacy'
      }
    }
    const v = mapWmpPayloadToVersion(legacyShape, {
      notificationMessageId: 'm'
    })
    expect(v.identifiers).toEqual({
      sbi: '107593059',
      crn: '1100957269',
      frn: '1076543210',
      defraId: undefined
    })
  })

  it('uses metadata and defaults when top-level payload fields are absent', () => {
    const payload = {
      ...wmpFixture,
      clientRef: undefined,
      scheme: undefined,
      metadata: {
        submittedAt: '2026-06-10T12:30:00.000Z',
        clientRef: 'wmp-from-metadata'
      },
      answers: {
        ...wmpFixture.answers,
        agreementName: undefined
      }
    }

    const v = mapWmpPayloadToVersion(payload, {
      notificationMessageId: 'm',
      uuid: fixedUuid
    })

    expect(v.agreementName).toBe('Woodland Management Plan')
    expect(v.clientRef).toBe('wmp-from-metadata')
    expect(v.scheme).toBe('WMP')
    expect(v.payment.agreementStartDate).toBe('2026-06-10')
    expect(v.payment.agreementEndDate).toBe('2027-06-10')
  })

  it('uses runtime date fallback when submitted dates are absent', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T10:20:30.000Z'))

    const payload = {
      ...wmpFixture,
      metadata: undefined,
      answers: {
        ...wmpFixture.answers,
        detailsConfirmedAt: undefined
      }
    }

    const v = mapWmpPayloadToVersion(payload, {
      notificationMessageId: 'm',
      uuid: fixedUuid
    })

    expect(v.payment.agreementStartDate).toBe('2026-08-15')
    expect(v.payment.agreementEndDate).toBe('2027-08-15')
  })

  it('falls back to hectares for parcel action unit and uses supplied sheetId', () => {
    const payload = {
      ...wmpFixture,
      answers: {
        ...wmpFixture.answers,
        landParcels: [
          { parcelId: 'SD1234-5678', sheetId: 'sheet-1', areaHa: 1 }
        ],
        payments: {
          agreement: [
            {
              ...wmpFixture.answers.payments.agreement[0],
              unit: undefined
            }
          ]
        }
      }
    }

    const v = mapWmpPayloadToVersion(payload, {
      notificationMessageId: 'm',
      uuid: fixedUuid
    })

    expect(v.application.parcel[0].actions[0].appliedFor.unit).toBe('ha')
    expect(v.actionApplications[0].sheetId).toBe('sheet-1')
  })
})
