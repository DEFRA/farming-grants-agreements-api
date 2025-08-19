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
})
