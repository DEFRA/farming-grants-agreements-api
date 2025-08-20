import { getAgreement } from '~/src/api/agreement/helpers/get-agreement.js'
import * as getAgreementDataModule from '~/src/api/agreement/helpers/get-agreement-data.js'

jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  getAgreementDataById: jest.fn()
}))

describe('getAgreement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should return rendered HTML', async () => {
    const mockAgreement = {
      status: 'offered',
      username: 'Test User',
      parcels: [],
      actions: [],
      payments: {
        activities: [],
        yearlyBreakdown: {
          details: [],
          annualTotals: {},
          totalAgreementPayment: 0
        }
      },
      agreementNumber: 'SFI123456789'
    }
    getAgreementDataModule.getAgreementDataById.mockResolvedValueOnce(
      mockAgreement
    )

    const agreement = await getAgreement('SFI123456789')

    expect(getAgreementDataModule.getAgreementDataById).toHaveBeenCalledWith(
      'SFI123456789'
    )
    expect(agreement).toEqual({
      actions: [],
      agreementLand: {
        data: [],
        headings: [
          {
            text: 'Parcel'
          },
          {
            text: 'Total parcel area (ha)'
          }
        ]
      },
      agreementLevelActions: {
        data: [],
        headings: [
          {
            text: 'Action code'
          },
          {
            text: 'Title'
          },
          {
            text: 'Action End date'
          },
          {
            text: 'Action Start date'
          },
          {
            text: 'Action duration'
          }
        ]
      },
      agreementNumber: 'SFI123456789',
      annualPaymentSchedule: {
        data: [
          [
            {
              text: 'Total'
            },
            {
              text: ''
            },
            {
              text: ''
            },
            {
              text: ''
            },
            {
              text: '£0.00'
            }
          ]
        ],
        headings: [
          {
            text: 'Code'
          },
          {
            text: 'Year 1'
          },
          {
            text: 'Year 2'
          },
          {
            text: 'Year 3'
          },
          {
            text: 'Total payment'
          }
        ]
      },
      farmerName: 'Test User',
      parcels: [],
      payments: {
        activities: [],
        yearlyBreakdown: {
          annualTotals: {},
          details: [],
          totalAgreementPayment: 0
        }
      },
      status: 'offered',
      summaryOfActions: {
        data: [],
        headings: [
          {
            text: 'Parcel'
          },
          {
            text: 'Code'
          },
          {
            text: 'Action'
          },
          {
            text: 'Total parcel area (ha)'
          },
          {
            text: 'Start date'
          },
          {
            text: 'End date'
          }
        ]
      },
      summaryOfPayments: {
        data: [],
        headings: [
          {
            text: 'Code'
          },
          {
            text: 'Action'
          },
          {
            text: 'Total area (ha)'
          },
          {
            text: 'Payment rate'
          },
          {
            text: 'Total yearly payment'
          }
        ]
      },
      username: 'Test User'
    })
  })

  test('should fail gracefully when agreement data retrieval fails', async () => {
    const errorMessage = 'Failed to retrieve agreement data'
    getAgreementDataModule.getAgreementDataById.mockRejectedValueOnce(
      new Error(errorMessage)
    )

    await expect(getAgreement('SFI123456789')).rejects.toThrow(errorMessage)
  })

  test('should throw Bad Request when agreementId is missing', async () => {
    await expect(getAgreement(null)).rejects.toThrow('Agreement ID is required')
    await expect(getAgreement(undefined)).rejects.toThrow(
      'Agreement ID is required'
    )
  })

  test('should throw Not Found when agreement is not returned', async () => {
    getAgreementDataModule.getAgreementDataById.mockResolvedValueOnce(undefined)
    await expect(getAgreement('SFI123456789')).rejects.toThrow(
      'Agreement not found SFI123456789'
    )
  })

  test('should compute tables from provided data with values', async () => {
    const agreementData = {
      status: 'offered',
      username: 'User Name',
      agreementNumber: 'SFI000000001',
      parcels: [
        {
          parcelNumber: 'ABC123',
          totalArea: 2.5,
          activities: [
            {
              code: 'ACT1',
              description: 'Action One',
              startDate: new Date('2024-01-01T00:00:00Z'),
              endDate: new Date('2024-12-31T00:00:00Z'),
              area: 1.25
            }
          ]
        }
      ],
      actions: [
        {
          code: 'ACT1',
          title: 'Action One Title',
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: new Date('2024-12-31T00:00:00Z'),
          duration: '1 year'
        }
      ],
      payments: {
        activities: [
          {
            code: 'ACT1',
            description: 'Action One',
            measurement: 2.5,
            rate: 123,
            annualPayment: 456
          }
        ],
        yearlyBreakdown: {
          details: [
            {
              code: 'ACT1',
              year1: 100,
              year2: 200,
              year3: 300,
              totalPayment: 600
            }
          ],
          annualTotals: { year1: 100, year2: 200, year3: 300 },
          totalAgreementPayment: 600
        }
      }
    }

    const agreement = await getAgreement('SFI000000001', agreementData)

    // Agreement land table should have one row with parcel info
    expect(agreement.agreementLand.data).toHaveLength(1)
    expect(agreement.agreementLand.data[0][0].text).toBe('ABC123')
    expect(agreement.agreementLand.data[0][1].text).toBe(2.5)

    // Summary of actions should reflect activity mapping
    expect(agreement.summaryOfActions.data).toHaveLength(1)
    expect(agreement.summaryOfActions.data[0][1].text).toBe('ACT1')
    expect(agreement.summaryOfActions.data[0][2].text).toBe('Action One')

    // Agreement level actions should include formatted dates and duration
    expect(agreement.agreementLevelActions.data).toHaveLength(1)
    expect(agreement.agreementLevelActions.data[0][0].text).toBe('ACT1')
    expect(agreement.agreementLevelActions.data[0][4].text).toBe('1 year')

    // Summary of payments should include currency formatting
    expect(agreement.summaryOfPayments.data).toHaveLength(1)
    expect(agreement.summaryOfPayments.data[0][3].text).toContain('per ha')
    expect(agreement.summaryOfPayments.data[0][4].text).toMatch(/£\d/)

    // Annual payment schedule should include row for detail and a Total row
    expect(agreement.annualPaymentSchedule.data).toHaveLength(2)
    expect(agreement.annualPaymentSchedule.data[0][0].text).toBe('ACT1')
    expect(agreement.annualPaymentSchedule.data[1][0].text).toBe('Total')

    // Farmer name is copied from username
    expect(agreement.farmerName).toBe('User Name')
  })
})
