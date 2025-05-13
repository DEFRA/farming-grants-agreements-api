import { createAgreement } from './create-agreement.js'
import agreementsModel from '~/src/api/common/models/agreements.js'

jest.mock('~/src/api/common/models/agreements.js')

const targetDataStructure = {
  agreementNumber: 'SFI987654321',
  agreementName: 'Sample Agreement',
  correlationId: '1234545918345918475',
  frn: '1234567890',
  sbi: '1234567890',
  company: 'Sample Farm Ltd',
  address: '123 Farm Lane, Farmville',
  postcode: 'FA12 3RM',
  username: 'Diana Peart',
  agreementStartDate: '2025-05-13',
  agreementEndDate: '2028-05-13',
  actions: [],
  parcels: [
    {
      parcelNumber: 'SX06799238',
      parcelName: '',
      totalArea: 62.459999999999994,
      activities: [
        {
          code: 'CSAM1',
          description: '',
          area: 20.23,
          startDate: '2025-05-13',
          endDate: '2028-05-13'
        },
        {
          code: 'CSAM3',
          description: '',
          area: 42.23,
          startDate: '2025-05-13',
          endDate: '2028-05-13'
        }
      ]
    },
    {
      parcelNumber: 'SX06799240',
      parcelName: '',
      totalArea: 10.73,
      activities: [
        {
          code: 'CSAM1',
          description: '',
          area: 10.73,
          startDate: '2025-05-13',
          endDate: '2028-05-13'
        }
      ]
    }
  ],
  payments: {
    activities: [
      {
        code: 'CSAM1',
        description: '',
        quantity: 30.96,
        rate: 6,
        measurement: '30.96 ha',
        paymentRate: '6.00/ha',
        annualPayment: 185.76
      },
      {
        code: 'CSAM3',
        description: '',
        quantity: 42.23,
        rate: 6,
        measurement: '42.23 ha',
        paymentRate: '6.00/ha',
        annualPayment: 253.38
      }
    ],
    totalAnnualPayment: 439.14,
    yearlyBreakdown: {
      details: [
        {
          code: 'CSAM1',
          year1: 185.76,
          year2: 185.76,
          year3: 185.76,
          totalPayment: 557.28
        },
        {
          code: 'CSAM3',
          year1: 253.38,
          year2: 253.38,
          year3: 253.38,
          totalPayment: 760.14
        }
      ],
      annualTotals: {
        year1: 439.14,
        year2: 439.14,
        year3: 439.14
      },
      totalAgreementPayment: 1317.42
    }
  }
}

describe('createAgreement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    agreementsModel.create.mockImplementation((data) => Promise.resolve(data))
  })

  it('should create an agreement with valid data', async () => {
    const agreementData = {
      clientRef: 'ref-1234',
      code: 'frps-private-beta',
      createdAt: '2023-10-01T12:00:00Z',
      submittedAt: '2023-10-01T11:00:00Z',
      identifiers: {
        sbi: '1234567890',
        frn: '1234567890',
        crn: '1234567890',
        defraId: '1234567890'
      },
      answers: {
        scheme: 'SFI',
        year: 2025,
        agreementName: 'Sample Agreement',
        hasCheckedLandIsUpToDate: true,
        actionApplications: [
          {
            parcelId: '9238',
            sheetId: 'SX0679',
            code: 'CSAM1',
            appliedFor: {
              unit: 'ha',
              quantity: 20.23
            }
          },
          {
            parcelId: '9238',
            sheetId: 'SX0679',
            code: 'CSAM3',
            appliedFor: {
              unit: 'ha',
              quantity: 42.23
            }
          },
          {
            parcelId: '9240',
            sheetId: 'SX0679',
            code: 'CSAM1',
            appliedFor: {
              unit: 'ha',
              quantity: 10.73
            }
          }
        ]
      }
    }

    const result = await createAgreement(agreementData)

    // Check if the result matches the target data structure
    expect(result).toEqual({
      ...targetDataStructure,
      agreementNumber: expect.any(String),
      correlationId: expect.any(String)
    })
  })
})
