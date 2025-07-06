import { v4 as uuidv4 } from 'uuid'

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
    agreementNumber: 'SFI987654321',
    agreementName: 'Sample Agreement',
    correlationId: uuidv4(),
    frn: '9876543210',
    sbi: '117235001',
    company: 'Sample Farm Ltd',
    address: '123 Farm Lane, Farmville',
    postcode: 'FA12 3RM',
    username: 'Diana Peart',
    agreementStartDate: startDate,
    agreementEndDate: endDate,
    actions: [],
    parcels: [
      {
        parcelNumber: 'SX06799238',
        parcelName: '',
        totalArea: 10.73,
        activities: [
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 10.73,
            startDate,
            endDate,
            quantity: '10.73 ha'
          }
        ]
      }
    ],
    payments: {
      activities: [
        {
          code: 'CSAM1',
          description:
            'Assess soil, test soil organic matter and produce a soil management plan',
          quantity: 10.63,
          rate: 6.0,
          measurement: '10.63 HA',
          paymentRate: '6.00/ha',
          annualPayment: 63.78
        }
      ],
      totalAnnualPayment: 63.78,
      yearlyBreakdown: {
        details: [
          {
            code: 'CSAM1',
            year1: 63.78,
            year2: 63.78,
            year3: 63.78,
            totalPayment: 191.31
          }
        ],
        annualTotals: {
          year1: 63.78,
          year2: 63.78,
          year3: 63.78
        },
        totalAgreementPayment: 191.31
      }
    }
  },
  {
    agreementNumber: 'SFI123456789',
    agreementName: 'Sample Agreement',
    correlationId: uuidv4(),
    frn: '1234567890',
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
        duration: '3 years',
        quantity: '1.00 ha'
      },
      {
        code: 'MPAY1',
        title: 'SFI Management Payment',
        startDate,
        endDate,
        duration: '3 years',
        quantity: '1.00 ha'
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
            endDate,
            quantity: '95.00 Metres'
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 207.0,
            startDate,
            endDate,
            quantity: '207.00 Metres'
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 0.7287,
            startDate,
            endDate,
            quantity: '0.7287 ha'
          },
          {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            area: 0.7287,
            startDate,
            endDate,
            quantity: '0.7287 ha'
          },
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 234.0,
            startDate,
            endDate,
            quantity: '234.00 Metres'
          },
          {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            area: 207.0,
            startDate,
            endDate,
            quantity: '207.00 Metres'
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 0.7287,
            startDate,
            endDate,
            quantity: '0.7287 ha'
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
            endDate,
            quantity: '0.7287 ha'
          },
          {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            area: 265.0,
            startDate,
            endDate,
            quantity: '265.00 Metres'
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 265.0,
            startDate,
            endDate,
            quantity: '265.00 Metres'
          },
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 265.0,
            startDate,
            endDate,
            quantity: '265.00 Metres'
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
            endDate,
            quantity: '1.6108 ha'
          },
          {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            area: 1.6108,
            startDate,
            endDate,
            quantity: '1.6108 ha'
          },
          {
            code: 'CHRW3',
            description: manageHedgerowTreesDescription,
            area: 337.0,
            startDate,
            endDate,
            quantity: '337.00 Metres'
          },
          {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            area: 337.0,
            startDate,
            endDate,
            quantity: '337.00 Metres'
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 337.0,
            startDate,
            endDate,
            quantity: '337.00 Metres'
          },
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 374.0,
            startDate,
            endDate,
            quantity: '374.00 Metres'
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
            endDate,
            quantity: '640.00 Metres'
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 3.1213,
            startDate,
            endDate,
            quantity: '3.1213 ha'
          },
          {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            area: 3.1213,
            startDate,
            endDate,
            quantity: '3.1213 ha'
          },
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 430.0,
            startDate,
            endDate,
            quantity: '430.00 Metres'
          },
          {
            code: 'CHRW3',
            description: manageHedgerowTreesDescription,
            area: 230.0,
            startDate,
            endDate,
            quantity: '230.00 Metres'
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 640.0,
            startDate,
            endDate,
            quantity: '640.00 Metres'
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
            endDate,
            quantity: '50.00 Metres'
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 0.8291,
            startDate,
            endDate,
            quantity: '0.8291 ha'
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 150.0,
            startDate,
            endDate,
            quantity: '150.00 Metres'
          },
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 210.0,
            startDate,
            endDate,
            quantity: '210.00 Metres'
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
            endDate,
            quantity: '165.00 Metres'
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 0.4016,
            startDate,
            endDate,
            quantity: '0.4016 ha'
          },
          {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            area: 0.4016,
            startDate,
            endDate,
            quantity: '0.4016 ha'
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
            endDate,
            quantity: '150.00 Metres'
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 300.0,
            startDate,
            endDate,
            quantity: '300.00 Metres'
          },
          {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            area: 300.0,
            startDate,
            endDate,
            quantity: '300.00 Metres'
          },
          {
            code: 'CSAM1',
            description: assessSoilDescription,
            area: 2.7771,
            startDate,
            endDate,
            quantity: '2.7771 ha'
          },
          {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            area: 2.7771,
            startDate,
            endDate,
            quantity: '2.7771 ha'
          },
          {
            code: 'GRH8',
            description: 'Supplement: Haymaking (late cut)',
            area: 9.7091,
            startDate,
            endDate,
            quantity: '9.7091 ha'
          }
        ]
      }
    ],
    payments: {
      activities: [
        {
          code: 'BND1',
          description: 'Maintain dry stone walls',
          quantity: 95.0,
          rate: 25.65,
          measurement: '95.00 Metres',
          paymentRate: '£25.65/100m',
          annualPayment: 25.65
        },
        {
          code: 'BND2',
          description: earthBanksDescription,
          quantity: 1678.0,
          rate: 11.0,
          measurement: '1678.00 Metres',
          paymentRate: '11.00/100m',
          annualPayment: 184.58
        },
        {
          code: 'CHRW1',
          description: assessHedgerowDescription,
          quantity: 1799.0,
          rate: 5.0,
          measurement: '1799.00 Metres',
          paymentRate: '5.00/100m',
          annualPayment: 89.95
        },
        {
          code: 'CHRW2',
          description: manageHedgerowDescription,
          quantity: 1799.0,
          rate: 13.0,
          measurement: '1799.00 Metres',
          paymentRate: '13.00/100m',
          annualPayment: 233.87
        },
        {
          code: 'CHRW3',
          description: manageHedgerowTreesDescription,
          quantity: 717.0,
          rate: 10.0,
          measurement: '717.00 Metres',
          paymentRate: '10.00/100m',
          annualPayment: 71.7
        },
        {
          code: 'CLIG3',
          description: manageGrasslandDescription,
          quantity: 8.64,
          rate: 151.0,
          measurement: '8.64 HA',
          paymentRate: '151.00/ha',
          annualPayment: 1304.56
        },
        {
          code: 'CSAM1',
          description:
            'Assess soil, test soil organic matter and produce a soil management plan',
          quantity: 10.63,
          rate: 6.0,
          measurement: '10.63 HA',
          paymentRate: '6.00/ha',
          annualPayment: 63.78
        },
        {
          code: 'CSAM1A',
          description: assessSoilDescription,
          quantity: 1.0,
          rate: 97.0,
          measurement: '1.00 Units',
          paymentRate: '97.00/units',
          annualPayment: 97.0
        },
        {
          code: 'GRH8',
          description: 'Supplement: Haymaking (late cut)',
          quantity: 9.71,
          rate: 187.0,
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
  },
  {
    agreementNumber: 'SFI88888888',
    agreementName: 'Sample Agreement',
    correlationId: uuidv4(),
    frn: '8888888888',
    sbi: '888888888',
    company: 'Sample Farm Ltd',
    address: '123 Farm Lane, Farmville',
    postcode: 'FA12 3RM',
    username: 'John Doe',
    agreementStartDate: startDate,
    agreementEndDate: endDate,
    actions: [
      {
        code: 'BND1',
        title: 'Maintain dry stone walls',
        startDate,
        endDate,
        duration: '3 years',
        quantity: '1.00 ha'
      },
      {
        code: 'BND2',
        title: 'Maintain earth banks or stone-faced hedgebanks',
        startDate,
        endDate,
        duration: '3 years',
        quantity: '1.00 ha'
      },
      {
        code: 'CHRW1',
        title: 'Assess and record hedgerow condition',
        startDate,
        endDate,
        duration: '3 years',
        quantity: '1.00 ha'
      },
      {
        code: 'CHRW2',
        title: 'Manage hedgerows',
        startDate,
        endDate,
        duration: '3 years',
        quantity: '1.00 ha'
      },
      {
        code: 'CHRW3',
        title: 'Maintain or establish hedgerow trees',
        startDate,
        endDate,
        duration: '3 years',
        quantity: '1.00 ha'
      },
      {
        code: 'CLIG3',
        title:
          'Manage grassland with very low nutrient inputs - outside SDAs or within SDAs',
        startDate,
        endDate,
        duration: '3 years',
        quantity: '1.00 ha'
      },
      {
        code: 'CSAM1',
        title:
          'Assess soil, test soil organic matter and produce a soil management plan',
        startDate,
        endDate,
        duration: '3 years',
        quantity: '1.00 ha'
      },
      {
        code: 'CSAM1A',
        title:
          'Assess soil, produce a soil management plan and test soil organic matter',
        startDate,
        endDate,
        duration: '3 years',
        quantity: '1.00 ha'
      },
      {
        code: 'GRH8',
        title: 'Supplement: Haymaking (late cut)',
        startDate,
        endDate,
        duration: '3 years',
        quantity: '1.00 ha'
      }
    ],
    parcels: [
      {
        parcelNumber: 'SX64592661',
        parcelName: '',
        totalArea: 9.7091,
        activities: [
          {
            code: 'BND1',
            description: 'Maintain dry stone walls',
            area: 95.0,
            startDate,
            endDate,
            quantity: '95.00 Metres'
          },
          {
            code: 'BND2',
            description: earthBanksDescription,
            area: 1678.0,
            startDate,
            endDate,
            quantity: '1678.00 Metres'
          },
          {
            code: 'CHRW1',
            description: assessHedgerowDescription,
            area: 1799.0,
            startDate,
            endDate,
            quantity: '1799.00 Metres'
          },
          {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            area: 1799.0,
            startDate,
            endDate,
            quantity: '1799.00 Metres'
          },
          {
            code: 'CHRW3',
            description: manageHedgerowTreesDescription,
            area: 717.0,
            startDate,
            endDate,
            quantity: '717.00 Metres'
          },
          {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            area: 8.64,
            startDate,
            endDate,
            quantity: '8.64 ha'
          },
          {
            code: 'CSAM1',
            description:
              'Assess soil, test soil organic matter and produce a soil management plan',
            area: 10.63,
            startDate,
            endDate,
            quantity: '10.63 ha'
          },
          {
            code: 'CSAM1A',
            description: assessSoilDescription,
            area: 1.0,
            startDate,
            endDate,
            quantity: '1.00 ha'
          },
          {
            code: 'GRH8',
            description: 'Supplement: Haymaking (late cut)',
            area: 9.7091,
            startDate,
            endDate,
            quantity: '9.7091 ha'
          }
        ]
      }
    ],
    payments: {
      activities: [
        {
          code: 'BND1',
          description: 'Maintain dry stone walls',
          quantity: 95.0,
          rate: 25.65,
          measurement: '95.00 Metres',
          paymentRate: '£25.65/100m',
          annualPayment: 25.65
        },
        {
          code: 'BND2',
          description: earthBanksDescription,
          quantity: 1678.0,
          rate: 11.0,
          measurement: '1678.00 Metres',
          paymentRate: '11.00/100m',
          annualPayment: 184.58
        },
        {
          code: 'CHRW1',
          description: assessHedgerowDescription,
          quantity: 1799.0,
          rate: 5.0,
          measurement: '1799.00 Metres',
          paymentRate: '5.00/100m',
          annualPayment: 89.95
        },
        {
          code: 'CHRW2',
          description: manageHedgerowDescription,
          quantity: 1799.0,
          rate: 13.0,
          measurement: '1799.00 Metres',
          paymentRate: '13.00/100m',
          annualPayment: 233.87
        },
        {
          code: 'CHRW3',
          description: manageHedgerowTreesDescription,
          quantity: 717.0,
          rate: 10.0,
          measurement: '717.00 Metres',
          paymentRate: '10.00/100m',
          annualPayment: 71.7
        },
        {
          code: 'CLIG3',
          description: manageGrasslandDescription,
          quantity: 8.64,
          rate: 151.0,
          measurement: '8.64 HA',
          paymentRate: '151.00/ha',
          annualPayment: 1304.56
        },
        {
          code: 'CSAM1',
          description:
            'Assess soil, test soil organic matter and produce a soil management plan',
          quantity: 10.63,
          rate: 6.0,
          measurement: '10.63 HA',
          paymentRate: '6.00/ha',
          annualPayment: 63.78
        },
        {
          code: 'CSAM1A',
          description: assessSoilDescription,
          quantity: 1.0,
          rate: 97.0,
          measurement: '1.00 Units',
          paymentRate: '97.00/units',
          annualPayment: 97.0
        },
        {
          code: 'GRH8',
          description: 'Supplement: Haymaking (late cut)',
          quantity: 9.71,
          rate: 187.0,
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
          }
        ],
        annualTotals: {
          year1: 3886.69,
          year2: 3886.69,
          year3: 3886.69
        },
        totalAgreementPayment: 11660.07
      }
    }
  },
  {
    agreementNumber: 'SFI999999999',
    agreementName: 'Sample Agreement',
    correlationId: uuidv4(),
    frn: '9999999990',
    sbi: '999999999',
    company: 'Agile Farm',
    address: '123 Farm Lane, Farmville',
    postcode: 'FA12 3RM',
    username: 'Alfred Waldron',
    agreementStartDate: startDate,
    agreementEndDate: endDate,
    actions: [
      {
        code: 'CMOR1',
        name: 'Assess moorland and produce a written record',
        title: 'Assess moorland and produce a written record',
        startDate,
        endDate,
        duration: '3 years',
        landParcel: 'SO3757 3159',
        quantity: '8.3405 ha'
      },
      {
        code: 'UPL3',
        name: 'Limited livestock grazing on moorland',
        title: 'Limited livestock grazing on moorland',
        startDate,
        endDate,
        duration: '3 years',
        landParcel: 'SO3757 3159',
        quantity: '8.3405 ha'
      },
      {
        code: 'UPL4',
        name: 'Keep cattle and ponies on moorland supplement (minimum 30% GLU)',
        title:
          'Keep cattle and ponies on moorland supplement (minimum 30% GLU)',
        startDate,
        endDate,
        duration: '3 years',
        landParcel: 'SO3757 3159',
        quantity: '8.3405 ha'
      },
      {
        code: 'SPM5',
        name: 'Keep native breeds on extensively managed habitats supplement (more than 80%)',
        title:
          'Keep native breeds on extensively managed habitats supplement (more than 80%)',
        startDate,
        endDate,
        duration: '3 years',
        landParcel: 'SO3757 3159',
        quantity: '8.3405 ha'
      },
      {
        code: 'UPL10',
        name: 'Shepherding livestock on moorland (remove stock for at least 8 months)',
        title:
          'Shepherding livestock on moorland (remove stock for at least 8 months)',
        startDate,
        endDate,
        duration: '3 years',
        landParcel: 'SO3757 3159',
        quantity: '8.3405 ha'
      }
    ],
    parcels: [
      {
        parcelNumber: 'SO3757 3159',
        parcelName: '',
        totalArea: 8.3405,
        activities: [
          {
            code: 'CMOR1',
            description: 'Assess moorland and produce a written record',
            area: 8.3405,
            quantity: '8.3405 ha',
            startDate,
            endDate
          },
          {
            code: 'UPL3',
            description: 'Limited livestock grazing on moorland',
            area: 8.3405,
            quantity: '8.3405 ha',
            startDate,
            endDate
          },
          {
            code: 'UPL4',
            description:
              'Keep cattle and ponies on moorland supplement (minimum 30% GLU)',
            area: 8.3405,
            quantity: '8.3405 ha',
            startDate,
            endDate
          },
          {
            code: 'SPM5',
            description:
              'Keep native breeds on extensively managed habitats supplement (more than 80%)',
            area: 8.3405,
            quantity: '8.3405 ha',
            startDate,
            endDate
          },
          {
            code: 'UPL10',
            description:
              'Shepherding livestock on moorland (remove stock for at least 8 months)',
            area: 8.3405,
            quantity: '8.3405 ha',
            startDate,
            endDate
          }
        ]
      }
    ],
    payments: {
      activities: [
        {
          code: 'CMOR1',
          description: 'Assess moorland and produce a written record',
          paymentRate: '£10.60 per ha and £27.27 per ha',
          rate: 10.6,
          quantity: 8.3405,
          measurement: '8.3405 ha',
          annualPayment: 360.41,
          quarterly: '£90.10',
          yearly: '£360.41'
        },
        {
          code: 'UPL3',
          description: 'Limited livestock grazing on moorland',
          paymentRate: '£66 per hectare',
          rate: 66,
          quantity: 8.3405,
          measurement: '8.3405 ha',
          annualPayment: 550.47,
          quarterly: '£137.61',
          yearly: '£550.47'
        },
        {
          code: 'UPL4',
          description:
            'Keep cattle and ponies on moorland supplement (minimum 30% GLU)',
          paymentRate: '£27 per hectare',
          rate: 27,
          quantity: 8.3405,
          measurement: '8.3405 ha',
          annualPayment: 58.39,
          quarterly: '£14.60',
          yearly: '£58.39'
        },
        {
          code: 'SPM5',
          description:
            'Keep native breeds on extensively managed habitats supplement (more than 80%)',
          paymentRate: '£21 per hectare',
          rate: 21,
          quantity: 8.3405,
          measurement: '8.3405 ha',
          annualPayment: 91.75,
          quarterly: '£22.94',
          yearly: '£91.75'
        },
        {
          code: 'UPL10',
          description:
            'Shepherding livestock on moorland (remove stock for at least 8 months)',
          paymentRate: '£48 per hectare',
          rate: 48,
          quantity: 8.3405,
          measurement: '8.3405 ha',
          annualPayment: 400.34,
          quarterly: '£100.09',
          yearly: '£400.34'
        }
      ],
      totalQuarterly: '£365.35',
      totalAnnualPayment: 1461.36,
      yearlyBreakdown: {
        details: [
          {
            code: 'CMOR1',
            year1: 360.41,
            year2: 360.41,
            year3: 360.41,
            totalPayment: 1081.23
          },
          {
            code: 'UPL3',
            year1: 550.47,
            year2: 550.47,
            year3: 550.47,
            totalPayment: 1651.41
          },
          {
            code: 'UPL4',
            year1: 58.39,
            year2: 58.39,
            year3: 58.39,
            totalPayment: 175.17
          },
          {
            code: 'SPM5',
            year1: 91.75,
            year2: 91.75,
            year3: 91.75,
            totalPayment: 275.25
          },
          {
            code: 'UPL10',
            year1: 400.34,
            year2: 400.34,
            year3: 400.34,
            totalPayment: 1201.02
          }
        ],
        annualTotals: {
          year1: 1461.36,
          year2: 1461.36,
          year3: 1461.36
        },
        totalAgreementPayment: 4384.08
      }
    }
  }
]
