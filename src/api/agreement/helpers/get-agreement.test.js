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
              text: '44'
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
              text: '44'
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
      { text: 'ABC123' },
      { text: 2.5 }
    ])

    // Summary of actions should now have data
    expect(agreement.summaryOfActions.data).toHaveLength(1)
    expect(agreement.summaryOfActions.data[0]).toEqual([
      { text: 'ABC123' },
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
})
