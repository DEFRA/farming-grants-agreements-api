import { buildLegacyPaymentFromApplication } from './legacy-application-mapper.js'

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
})
