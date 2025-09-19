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
      agreementNumber: 'SFI123456789',
      status: 'offered',
      actionApplications: [
        {
          sheetId: 'SX635990',
          parcelId: '44',
          code: 'BND1',
          appliedFor: {
            quantity: 95,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          code: 'CHRW1',
          appliedFor: {
            quantity: 207,
            unit: 'metres'
          }
        }
      ],
      payment: {
        agreementStartDate: '2024-01-01',
        agreementEndDate: '2024-12-31',
        frequency: 'Quarterly',
        agreementTotalPence: 6413247,
        annualTotalPence: 6440447,
        parcelItems: {
          1: {
            code: 'BND1',
            description: 'Maintain dry stone walls',
            version: 1,
            unit: 'metres',
            quantity: 95,
            rateInPence: 2565,
            annualPaymentPence: 243675,
            sheetId: 'SX635990',
            parcelId: '44'
          },
          2: {
            code: 'CHRW1',
            description: 'CHRW1: Assess and record hedgerow condition',
            version: 1,
            unit: 'metres',
            quantity: 207,
            rateInPence: 500,
            annualPaymentPence: 949500,
            sheetId: 'SX635990',
            parcelId: '44'
          }
        },
        agreementLevelItems: {
          1: {
            code: 'CSAM1',
            description:
              'CSAM1: Assess soil, produce a soil management plan and test soil organic matter',
            version: 1,
            annualPaymentPence: 27200
          }
        },
        payments: [
          {
            totalPaymentPence: 1610112,
            paymentDate: '2025-12-05',
            lineItems: [
              {
                agreementLevelItems: 1,
                paymentPence: 6800
              },
              {
                parcelItemId: 1,
                paymentPence: 60919
              }
            ]
          }
        ]
      }
    }
    getAgreementDataModule.getAgreementDataById.mockResolvedValueOnce(
      mockAgreement
    )

    const agreement = await getAgreement('SFI123456789')

    expect(getAgreementDataModule.getAgreementDataById).toHaveBeenCalledWith(
      'SFI123456789'
    )
    expect(agreement).toEqual({
      ...mockAgreement,
      annualPaymentSchedule: {
        data: [
          [
            {
              text: 'BND1'
            },
            {
              text: '£609.19'
            },
            {
              text: '£609.19'
            }
          ],
          [
            {
              text: 'Total'
            },
            {
              text: '£609.19'
            },
            {
              text: '£609.19'
            }
          ]
        ],
        headings: [
          {
            text: 'Code'
          },
          {
            text: 2025
          },
          {
            text: 'Total payment'
          }
        ]
      },
      status: 'offered',
      summaryOfActions: {
        data: [
          [
            {
              text: 'SX635990 44',
              attributes: {
                style: 'white-space: nowrap'
              }
            },
            {
              text: 'BND1'
            },
            {
              text: 'Maintain dry stone walls'
            },
            {
              text: 95
            },
            {
              text: '01/01/2024'
            },
            {
              text: '31/12/2024'
            }
          ],
          [
            {
              text: 'SX635990 44',
              attributes: {
                style: 'white-space: nowrap'
              }
            },
            {
              text: 'CHRW1'
            },
            {
              text: 'Assess and record hedgerow condition'
            },
            {
              text: 207
            },
            {
              text: '01/01/2024'
            },
            {
              text: '31/12/2024'
            }
          ]
        ],
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
        data: [
          [
            {
              text: 'BND1'
            },
            {
              text: 'Maintain dry stone walls'
            },
            {
              text: 95
            },
            {
              text: '£25.65 per metre'
            },
            {
              text: '£2,436.75'
            }
          ],
          [
            {
              text: 'CHRW1'
            },
            {
              text: 'CHRW1: Assess and record hedgerow condition'
            },
            {
              text: 207
            },
            {
              text: '£5.00 per metre'
            },
            {
              text: '£9,495.00'
            }
          ],
          [
            {
              text: 'CSAM1'
            },
            {
              text: 'One-off payment per agreement per year for Assess soil, produce a soil management plan and test soil organic matter'
            },
            {
              text: ''
            },
            {
              text: ''
            },
            {
              text: '£272.00'
            }
          ]
        ],
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
      }
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
      payment: {
        parcelItems: {
          'parcel-item-1': {
            sheetId: 'SX635990',
            parcelId: 'ABC123',
            code: 'ACT1',
            description: 'ACT1: Action One',
            quantity: 2.5,
            rateInPence: 12300,
            unit: 'hectares',
            annualPaymentPence: 45600
          }
        },
        agreementLevelItems: {},
        payments: [
          {
            paymentDate: '2024-01-01',
            lineItems: [
              {
                parcelItemId: 'parcel-item-1',
                paymentPence: 45600
              }
            ]
          }
        ],
        agreementStartDate: '2024-01-01',
        agreementEndDate: '2024-12-31'
      }
    }

    const agreement = await getAgreement('SFI000000001', agreementData)

    // Agreement land table should now have data
    expect(agreement.agreementLand.data).toHaveLength(1)
    expect(agreement.agreementLand.data[0]).toEqual([
      { text: 'SX635990 ABC123' },
      { text: 2.5 }
    ])

    // Summary of actions should now have data
    expect(agreement.summaryOfActions.data).toHaveLength(1)
    expect(agreement.summaryOfActions.data[0]).toEqual([
      {
        text: 'SX635990 ABC123',
        attributes: {
          style: 'white-space: nowrap'
        }
      },
      { text: 'ACT1' },
      { text: 'Action One' },
      { text: 2.5 },
      { text: '01/01/2024' },
      { text: '31/12/2024' }
    ])

    // Summary of payments should now have data
    expect(agreement.summaryOfPayments.data).toHaveLength(1)
    expect(agreement.summaryOfPayments.data[0][0].text).toBe('ACT1')

    // Annual payment schedule should now have data
    expect(agreement.annualPaymentSchedule.data).toHaveLength(2) // ACT1 + Total
    expect(agreement.annualPaymentSchedule.data[0][0].text).toBe('ACT1')
    expect(agreement.annualPaymentSchedule.data[1][0].text).toBe('Total')
  })

  test('should handle string rate and null currency formatting', async () => {
    const agreementData = {
      status: 'offered',
      agreementNumber: 'SFI-STR-NLL',
      payment: {
        parcelItems: {
          'parcel-item-x': {
            sheetId: 'SX635990',
            parcelId: 'XYZ789',
            code: 'STR1',
            description: 'STR1: String rate formatting',
            quantity: 1,
            rateInPence: '£1,234', // triggers string branch in formatCurrency
            unit: 'metres',
            annualPaymentPence: null // triggers null branch in formatCurrency
          }
        },
        agreementLevelItems: {},
        payments: [],
        agreementStartDate: '2024-01-01',
        agreementEndDate: '2024-12-31'
      }
    }

    const agreement = await getAgreement('SFI-STR-NLL', agreementData)

    expect(agreement.summaryOfPayments.data).toHaveLength(1)
    const [codeCell, actionCell, areaCell, rateCell, totalCell] =
      agreement.summaryOfPayments.data[0]
    expect(codeCell.text).toBe('STR1')
    expect(actionCell.text).toBe('STR1: String rate formatting')
    expect(areaCell.text).toBe(1)
    // String branch strips non-numerics → "1234 per metre"
    expect(rateCell.text).toBe('1234 per metre')
    // Null branch returns empty string
    expect(totalCell.text).toBe('')
  })

  test('should build schedule using agreementLevelItemId and sort codes numerically', async () => {
    const agreementData = {
      status: 'offered',
      agreementNumber: 'SFI-SCH-AL',
      payment: {
        parcelItems: {
          p1: {
            sheetId: 'SX635990',
            parcelId: 'AAA111',
            code: 'A2',
            description: 'A2: Parcel action',
            quantity: 1,
            rateInPence: 100,
            unit: 'hectares',
            annualPaymentPence: 200
          }
        },
        agreementLevelItems: {
          al1: {
            code: 'A10',
            description: 'A10: Agreement-level item',
            annualPaymentPence: 300
          }
        },
        payments: [
          {
            paymentDate: '2023-06-01',
            lineItems: [{ parcelItemId: 'p1', paymentPence: 1000 }]
          },
          {
            paymentDate: '2024-06-01',
            lineItems: [
              { agreementLevelItemId: 'al1', paymentPence: 2000 } // triggers agreementLevelItemId branch
            ]
          }
        ],
        agreementStartDate: '2023-01-01',
        agreementEndDate: '2024-12-31'
      }
    }

    const agreement = await getAgreement('SFI-SCH-AL', agreementData)

    // Expect two year headings (2023, 2024) and a Total column
    const headingsText = agreement.annualPaymentSchedule.headings.map(
      (h) => h.text
    )
    expect(headingsText).toEqual(['Code', 2023, 2024, 'Total payment'])

    // Expect rows sorted numerically by code: A2 before A10
    const rows = agreement.annualPaymentSchedule.data
    expect(rows).toHaveLength(3) // A2, A10, Total
    expect(rows[0][0].text).toBe('A2')
    expect(rows[1][0].text).toBe('A10')

    // Values formatted as currency strings
    // A2 has value in 2023 only
    expect(rows[0][1].text).toBe('£10.00') // 1000 pence
    expect(rows[0][2].text).toBe('£0.00')
    expect(rows[0][3].text).toBe('£10.00')

    // A10 has value in 2024 only (from agreementLevelItemId)
    expect(rows[1][1].text).toBe('£0.00')
    expect(rows[1][2].text).toBe('£20.00') // 2000 pence
    expect(rows[1][3].text).toBe('£20.00')

    // Totals row
    expect(rows[2][0].text).toBe('Total')
    expect(rows[2][1].text).toBe('£10.00')
    expect(rows[2][2].text).toBe('£20.00')
    expect(rows[2][3].text).toBe('£30.00')
  })
})
