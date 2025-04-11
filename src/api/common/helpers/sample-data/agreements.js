const startDate = '2024-11-01'
const endDate = '2027-10-31'
const assessHedgerowDescription = 'Assess and record hedgerow condition'
const assessSoilDescription =
  'Assess soil, produce a soil management plan and test soil organic matter'
const manageGrasslandDescription =
  'Manage grassland with very low nutrient inputs - outside SDAs or within SDAs'
const earthBanksDescription = 'Maintain earth banks or stone-faced hedgebanks'
const manageHedgerowDescription = 'Manage hedgerows'
const manageHedgerowTreesDescription = 'Maintain or establish hedgerow trees'

export default [
  {
    agreementNumber: 'SFI123456789',
    agreementName: 'Sample Agreement',
    sbi: '123456789',
    company: 'Sample Farm Ltd',
    address: '123 Farm Lane, Farmville',
    postcode: 'FA12 3RM',
    username: 'John Doe',
    agreementStartDate: startDate,
    agreementEndDate: endDate,
    actions: [
      {
        code: 'CSAM1A',
        title:
          'Assess soil, test soil organic matter and produce a soil management plan',
        startDate,
        endDate,
        duration: '3 years'
      },
      {
        code: 'MPAY1',
        title: 'SFI Management Payment',
        startDate,
        endDate,
        duration: '3 years'
      }
    ],
    parcels: [
      {
        parcelNumber: 'SX63599044',
        parcelName: '',
        totalArea: 0.7306,
        activities: [
          {
            code: 'BND1',
            description: 'Maintain dry stone walls',
            area: 95.0,
            startDate,
            endDate
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 207.0,
            startDate,
            endDate
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 0.7287,
            startDate,
            endDate
          },
          {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            area: 0.7287,
            startDate,
            endDate
          },
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 234.0,
            startDate,
            endDate
          },
          {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            area: 207.0,
            startDate,
            endDate
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 0.7287,
            startDate,
            endDate
          }
        ]
      },
      {
        parcelNumber: 'SX63599173',
        parcelName: '',
        totalArea: 1.5034,
        activities: [
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 0.7287,
            startDate,
            endDate
          },
          {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            area: 265.0,
            startDate,
            endDate
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 265.0,
            startDate,
            endDate
          },
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 265.0,
            startDate,
            endDate
          }
        ]
      },
      {
        parcelNumber: 'SX63599555',
        parcelName: '',
        totalArea: 1.6108,
        activities: [
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 1.6108,
            startDate,
            endDate
          },
          {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            area: 1.6108,
            startDate,
            endDate
          },
          {
            code: 'CHRW3',
            description: manageHedgerowTreesDescription,
            area: 337.0,
            startDate,
            endDate
          },
          {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            area: 337.0,
            startDate,
            endDate
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 337.0,
            startDate,
            endDate
          },
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 374.0,
            startDate,
            endDate
          }
        ]
      },
      {
        parcelNumber: 'SX64590858',
        parcelName: '',
        totalArea: 3.1213,
        activities: [
          {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            area: 640.0,
            startDate,
            endDate
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 3.1213,
            startDate,
            endDate
          },
          {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            area: 3.1213,
            startDate,
            endDate
          },
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 430.0,
            startDate,
            endDate
          },
          {
            code: 'CHRW3',
            description: manageHedgerowTreesDescription,
            area: 230.0,
            startDate,
            endDate
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 640.0,
            startDate,
            endDate
          }
        ]
      },
      {
        parcelNumber: 'SX64591081',
        parcelName: '',
        totalArea: 0.8637,
        activities: [
          {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            area: 50.0,
            startDate,
            endDate
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 0.8291,
            startDate,
            endDate
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 150.0,
            startDate,
            endDate
          },
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 210.0,
            startDate,
            endDate
          }
        ]
      },
      {
        parcelNumber: 'SX64591369',
        parcelName: '',
        totalArea: 0.4016,
        activities: [
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 165.0,
            startDate,
            endDate
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 0.4016,
            startDate,
            endDate
          },
          {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            area: 0.4016,
            startDate,
            endDate
          }
        ]
      },
      {
        parcelNumber: 'SX64592661',
        parcelName: '',
        totalArea: 2.7771,
        activities: [
          {
            code: 'CHRW3',
            description: manageHedgerowTreesDescription,
            area: 150.0,
            startDate,
            endDate
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 300.0,
            startDate,
            endDate
          },
          {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            area: 300.0,
            startDate,
            endDate
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 2.7771,
            startDate,
            endDate
          },
          {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            area: 2.7771,
            startDate,
            endDate
          },
          {
            code: 'GRH8',
            description: 'Supplement: Haymaking (late cut)',
            area: 9.7091,
            startDate,
            endDate
          }
        ]
      }
    ],
    payments: {
      activities: [
        {
          code: 'BND1',
          description: 'Maintain dry stone walls',
          measurement: '95.00 Metres',
          paymentRate: '£25.65/100m',
          annualPayment: 25.65
        },
        {
          code: 'BND2',
          description: earthBanksDescription,
          measurement: '1678.00 Metres',
          paymentRate: '11.00/100m',
          annualPayment: 184.58
        },
        {
          code: 'CHRW1',
          description: assessHedgerowDescription,
          measurement: '1799.00 Metres',
          paymentRate: '5.00/100m',
          annualPayment: 89.95
        },
        {
          code: 'CHRW2',
          description: manageHedgerowDescription,
          measurement: '1799.00 Metres',
          paymentRate: '13.00/100m',
          annualPayment: 233.87
        },
        {
          code: 'CHRW3',
          description: manageHedgerowTreesDescription,
          measurement: '717.00 Metres',
          paymentRate: '10.00/100m',
          annualPayment: 71.7
        },
        {
          code: 'CLIG3',
          description: manageGrasslandDescription,
          measurement: '8.64 HA',
          paymentRate: '151.00/ha',
          annualPayment: 1304.56
        },
        {
          code: 'CSAM1',
          description:
            'Assess soil, test soil organic matter and produce a soil management plan',
          measurement: '10.63 HA',
          paymentRate: '6.00/ha',
          annualPayment: 63.78
        },
        {
          code: 'CSAM1A',
          description: assessSoilDescription,
          measurement: '1.00 Units',
          paymentRate: '97.00/units',
          annualPayment: 97.0
        },
        {
          code: 'GRH8',
          description: 'Supplement: Haymaking (late cut)',
          measurement: '9.71 HA',
          paymentRate: '187.00/ha',
          annualPayment: 1815.61
        }
      ],
      totalAnnualPayment: 3886.69,
      yearlyBreakdown: {
        details: [
          {
            code: 'BND1',
            year1: 25.65,
            year2: 25.65,
            year3: 25.65,
            totalPayment: 76.95
          },
          {
            code: 'BND2',
            year1: 184.58,
            year2: 184.58,
            year3: 184.58,
            totalPayment: 553.74
          },
          {
            code: 'CHRW1',
            year1: 89.95,
            year2: 89.95,
            year3: 89.95,
            totalPayment: 269.85
          },
          {
            code: 'CHRW2',
            year1: 233.87,
            year2: 233.87,
            year3: 233.87,
            totalPayment: 701.61
          },
          {
            code: 'CHRW3',
            year1: 71.7,
            year2: 71.7,
            year3: 71.7,
            totalPayment: 215.1
          },
          {
            code: 'CLIG3',
            year1: 1304.56,
            year2: 1304.56,
            year3: 1304.56,
            totalPayment: 3913.68
          },
          {
            code: 'CSAM1',
            year1: 63.78,
            year2: 63.78,
            year3: 63.78,
            totalPayment: 191.31
          },
          {
            code: 'CSAM1A',
            year1: 97.0,
            year2: 97.0,
            year3: 97.0,
            totalPayment: 291.0
          },
          {
            code: 'GRH8',
            year1: 1815.61,
            year2: 1815.61,
            year3: 1815.61,
            totalPayment: 5446.83
          },
          {
            code: 'MPAY1',
            year1: 478.76,
            year2: 239.38,
            year3: 239.38,
            totalPayment: 957.52
          }
        ],
        annualTotals: {
          year1: 4365.45,
          year2: 4126.07,
          year3: 4126.07
        },
        totalAgreementPayment: 12617.59
      }
    }
  }
]
