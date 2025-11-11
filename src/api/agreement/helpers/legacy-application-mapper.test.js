import {
  buildLegacyPaymentFromApplication,
  __private__ as mapperPrivateExports
} from './legacy-application-mapper.js'

const { addMonths, addYears } = mapperPrivateExports

describe('legacy-application-mapper', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns empty object when application payload missing', () => {
    expect(buildLegacyPaymentFromApplication({})).toEqual({})
    expect(buildLegacyPaymentFromApplication(null)).toEqual({})
  })

  it('maps parcels and agreement level items when data provided', () => {
    const payload = {
      application: {
        applicant: { name: 'Test Farmer' },
        totalAnnualPaymentPence: 35150,
        agreementStartDate: '2025-02-01T00:00:00.000Z',
        agreementEndDate: '2028-02-01T00:00:00.000Z',
        paymentFrequency: 'Monthly',
        durationYears: 3,
        parcels: [
          {
            sheetId: 'AB1234',
            parcelId: '10001',
            actions: [
              {
                code: 'CMOR1',
                description: 'Assess moorland',
                durationYears: 3,
                appliedFor: { unit: 'ha', quantity: 7.5 },
                paymentRates: {
                  ratePerUnitPence: 1060,
                  agreementLevelAmountPence: 27200
                },
                annualPaymentPence: 35150
              }
            ]
          }
        ]
      }
    }

    const result = buildLegacyPaymentFromApplication(payload)

    expect(result.applicant).toEqual({ name: 'Test Farmer' })
    expect(result.actionApplications).toEqual([
      {
        parcelId: '10001',
        sheetId: 'AB1234',
        code: 'CMOR1',
        appliedFor: { unit: 'ha', quantity: 7.5 }
      }
    ])

    const payment = result.payment
    expect(payment.agreementStartDate).toBe('2025-02-01T00:00:00.000Z')
    expect(payment.agreementEndDate).toBe('2028-02-01T00:00:00.000Z')
    expect(payment.frequency).toBe('Monthly')
    expect(payment.annualTotalPence).toBe(35150)
    expect(payment.agreementTotalPence).toBe(35150 * 3)

    expect(payment.parcelItems['1']).toEqual({
      code: 'CMOR1',
      description: 'Assess moorland',
      version: 1,
      unit: 'ha',
      quantity: 7.5,
      rateInPence: 1060,
      annualPaymentPence: 35150,
      sheetId: 'AB1234',
      parcelId: '10001'
    })

    expect(payment.agreementLevelItems['1']).toEqual({
      code: 'CMOR1',
      description: 'Assess moorland',
      version: 1,
      annualPaymentPence: 27200
    })

    expect(payment.payments).toHaveLength(2)
    payment.payments.forEach((instalment) => {
      expect(instalment.totalPaymentPence).toBe(
        Math.round(35150 / 4) + Math.round(27200 / 4)
      )
      expect(instalment.lineItems).toHaveLength(2)
    })
  })

  it('derives totals and placeholders when optional fields missing', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-04-10T00:00:00.000Z'))

    const payload = {
      application: {
        applicant: { name: 'Fallback Farmer' },
        parcels: [
          {
            sheetId: 'XZ9999',
            parcelId: '20002',
            actions: [
              {
                code: 'ACTION1',
                description: 'Placeholder action',
                eligible: { unit: 'ha', quantity: 2 },
                paymentRates: { ratePerUnitPence: 500 }
              }
            ]
          }
        ]
      }
    }

    const result = buildLegacyPaymentFromApplication(payload)
    const payment = result.payment

    // Annual total calculated from rate and quantity (500 * 2 = 1000)
    expect(payment.annualTotalPence).toBe(1000)
    expect(payment.agreementTotalPence).toBe(1000) // duration defaults to 1 year
    expect(payment.agreementStartDate).toBe('2025-04-10T00:00:00.000Z') // falls back to now
    expect(payment.frequency).toBe('Quarterly') // default frequency

    // Payments fall back to evenly split quarters with derived dates
    expect(payment.payments).toEqual([
      expect.objectContaining({
        totalPaymentPence: 250,
        lineItems: [expect.objectContaining({ paymentPence: 250 })]
      }),
      expect.objectContaining({
        totalPaymentPence: 250,
        lineItems: [expect.objectContaining({ paymentPence: 250 })]
      })
    ])

    expect(payment.agreementLevelItems).toEqual({})
  })

  it('falls back when rate data invalid and dates missing', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T00:00:00.000Z'))

    const payload = {
      application: {
        totalAnnualPaymentPence: 1200,
        parcels: [
          {
            sheetId: 'SHEET-1',
            parcelId: 'PARCEL-1',
            actions: [
              {
                code: 'ACTION-NO-RATE',
                description: 'Action without numeric rate',
                eligible: { unit: 'ha' },
                paymentRates: { ratePerUnitPence: 'not-a-number' }
              }
            ]
          }
        ]
      }
    }

    const result = buildLegacyPaymentFromApplication(payload)
    const payment = result.payment

    // Start date falls back to current time
    expect(payment.agreementStartDate).toBe('2026-01-15T00:00:00.000Z')
    // End date derived by adding one year
    expect(payment.agreementEndDate).toBe('2027-01-15T00:00:00.000Z')
    expect(payment.frequency).toBe('Quarterly')
    expect(payment.annualTotalPence).toBe(1200)
    expect(payment.agreementTotalPence).toBe(1200)

    // Line items contain zero payments, totals fall back to annual total / 4
    expect(payment.payments).toEqual([
      {
        totalPaymentPence: 300,
        paymentDate: '2026-04-15T00:00:00.000Z',
        lineItems: [
          {
            parcelItemId: 1,
            paymentPence: 0
          }
        ]
      },
      {
        totalPaymentPence: 300,
        paymentDate: '2026-07-15T00:00:00.000Z',
        lineItems: [
          {
            parcelItemId: 1,
            paymentPence: 0
          }
        ]
      }
    ])
  })

  it('uses answers payment block when application and root dates missing', () => {
    const payload = {
      answers: {
        payment: {
          agreementStartDate: '2022-03-01T00:00:00.000Z',
          agreementEndDate: '2025-03-01T00:00:00.000Z'
        }
      },
      application: {
        applicant: {},
        parcels: [
          {
            sheetId: 'SHEET-ANS',
            parcelId: 'PARCEL-ANS',
            actions: [
              {
                code: 'ANS1',
                description: 'Action using answers start',
                durationYears: 2,
                annualPaymentPence: 1500
              }
            ]
          }
        ]
      }
    }

    const result = buildLegacyPaymentFromApplication(payload)
    const { payment } = result

    expect(payment.agreementStartDate).toBe('2022-03-01T00:00:00.000Z')
    expect(payment.agreementEndDate).toBe('2025-03-01T00:00:00.000Z')
    expect(payment.annualTotalPence).toBe(1500)
    expect(payment.agreementTotalPence).toBe(1500 * 2)
    expect(payment.inclusion.defaultDurationYears).toBe(1)
    expect(payment.inclusion.maxDurationYears).toBe(2)
  })

  it('prefers agreement-level fallbacks when application omits dates', () => {
    const payload = {
      agreementStartDate: '2024-01-01T00:00:00.000Z',
      agreementEndDate: '2028-01-01T00:00:00.000Z',
      answers: {
        payment: {
          agreementStartDate: '2023-05-01T00:00:00.000Z',
          agreementEndDate: '2027-05-01T00:00:00.000Z'
        }
      },
      application: {
        applicant: {},
        durationYears: '4',
        parcels: [
          {
            sheetId: 'SHEET-X',
            parcelId: 'PARCEL-X',
            actions: [
              {
                code: 'A1',
                description: 'Primary action',
                annualPaymentPence: 2000,
                paymentRates: {
                  agreementLevelAmountPence: 5000
                }
              },
              {
                code: 'A2',
                description: 'Secondary action',
                durationYears: 2,
                annualPaymentPence: 1000
              }
            ]
          }
        ]
      }
    }

    const result = buildLegacyPaymentFromApplication(payload)
    const { payment } = result
    const { agreementLevelItems, parcelItems, inclusion } = payment

    expect(payment.agreementStartDate).toBe('2024-01-01T00:00:00.000Z')
    expect(payment.agreementEndDate).toBe('2028-01-01T00:00:00.000Z')
    expect(payment.frequency).toBe('Quarterly')

    // Annual total = parcel annuals (2000 + 1000) + agreement-level amount (5000)
    expect(payment.annualTotalPence).toBe(8000)
    // Agreement total computed from annual payments * duration (A1 uses application duration 4, A2 uses 2)
    expect(payment.agreementTotalPence).toBe(2000 * 4 + 1000 * 2)

    expect(Object.keys(parcelItems)).toHaveLength(2)
    expect(parcelItems['1']).toMatchObject({
      code: 'A1',
      annualPaymentPence: 2000
    })
    expect(parcelItems['2']).toMatchObject({
      code: 'A2',
      annualPaymentPence: 1000
    })

    expect(Object.keys(agreementLevelItems)).toHaveLength(1)
    expect(agreementLevelItems['1']).toMatchObject({
      code: 'A1',
      annualPaymentPence: 5000
    })

    payment.payments.forEach((instalment) => {
      expect(instalment.totalPaymentPence).toBe(Math.round(8000 / 4))
      expect(instalment.lineItems).toHaveLength(3)
    })

    expect(inclusion).toEqual({
      defaultDurationYears: 4,
      maxDurationYears: 4,
      computedAgreementTotal: 2000 * 4 + 1000 * 2,
      computedAnnualTotal: 3000
    })
  })

  it('handles application with no parcels gracefully', () => {
    const payload = {
      application: {
        applicant: { name: 'No Parcel Applicant' }
      }
    }

    const result = buildLegacyPaymentFromApplication(payload)
    const { payment, applicant, actionApplications } = result

    expect(applicant).toEqual({ name: 'No Parcel Applicant' })
    expect(actionApplications).toEqual([])
    expect(payment.parcelItems).toEqual({})
    expect(payment.agreementLevelItems).toEqual({})
    expect(payment.annualTotalPence).toBe(0)
  })

  it('treats missing action list as empty during mapping', () => {
    const payload = {
      application: {
        applicant: {},
        parcels: [
          {
            sheetId: 'SHEET-EMPTY',
            parcelId: 'PARCEL-EMPTY'
            // no actions field
          }
        ]
      }
    }

    const result = buildLegacyPaymentFromApplication(payload)
    const { payment, actionApplications } = result

    expect(actionApplications).toEqual([])
    expect(payment.parcelItems).toEqual({})
    expect(payment.annualTotalPence).toBe(0)
  })

  it('falls back to zero dates when addMonths/addYears receive invalid values', () => {
    expect(addMonths(null, undefined)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(addYears(null, undefined)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
