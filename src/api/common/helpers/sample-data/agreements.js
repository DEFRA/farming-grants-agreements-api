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
    notificationMessageId: 'sample-notification-1',
    agreementNumber: 'SFI987654321',
    identifiers: {
      frn: '9876543210',
      sbi: '117235001'
    },
    answers: {
      agreementName: 'Sample Agreement',
      actionApplications: [
        {
          sheetId: 'SX067992',
          parcelId: '38',
          parcelName: '',
          code: 'CSAM1',
          description: assessSoilDescription,
          appliedFor: {
            quantity: 10.73,
            unit: 'HA'
          },
          rate: 6.0,
          startDate,
          endDate
        }
      ]
    }
  },
  {
    notificationMessageId: 'sample-notification-2',
    agreementNumber: 'SFI123456789',
    identifiers: {
      frn: '1234567890',
      sbi: '106284736'
    },
    answers: {
      agreementName: 'Sample Agreement',
      actionApplications: [
        {
          sheetId: 'SX635990',
          parcelId: '44',
          parcelName: '',
          code: 'BND1',
          description: 'Maintain dry stone walls',
          appliedFor: {
            quantity: 95.0,
            unit: 'Metres'
          },
          rate: 25.65,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          parcelName: '',
          code: 'CHRW1',
          description: assessHedgerowDescription,
          appliedFor: {
            quantity: 207.0,
            unit: 'Metres'
          },
          rate: 5.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          parcelName: '',
          code: 'CSAM1',
          description: assessSoilDescription,
          appliedFor: {
            quantity: 0.7287,
            unit: 'HA'
          },
          rate: 6.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          parcelName: '',
          code: 'CLIG3',
          description: manageGrasslandDescription,
          appliedFor: {
            quantity: 0.7287,
            unit: 'HA'
          },
          rate: 151.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          parcelName: '',
          code: 'BND2',
          description: earthBanksDescription,
          appliedFor: {
            quantity: 234.0,
            unit: 'Metres'
          },
          rate: 11.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          parcelName: '',
          code: 'CHRW2',
          description: manageHedgerowDescription,
          appliedFor: {
            quantity: 207.0,
            unit: 'Metres'
          },
          rate: 13.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          parcelName: '',
          code: 'CSAM1',
          description: assessSoilDescription,
          appliedFor: {
            quantity: 0.7287,
            unit: 'HA'
          },
          rate: 6.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635991',
          parcelId: '73',
          parcelName: '',
          code: 'CSAM1',
          description: assessSoilDescription,
          appliedFor: {
            quantity: 0.7287,
            unit: 'HA'
          },
          rate: 6.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635991',
          parcelId: '73',
          parcelName: '',
          code: 'CHRW2',
          description: manageHedgerowDescription,
          appliedFor: {
            quantity: 265.0,
            unit: 'Metres'
          },
          rate: 13.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635991',
          parcelId: '73',
          parcelName: '',
          code: 'CHRW1',
          description: assessHedgerowDescription,
          appliedFor: {
            quantity: 265.0,
            unit: 'Metres'
          },
          rate: 5.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635991',
          parcelId: '73',
          parcelName: '',
          code: 'BND2',
          description: earthBanksDescription,
          appliedFor: {
            quantity: 265.0,
            unit: 'Metres'
          },
          rate: 11.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          parcelName: '',
          code: 'CSAM1',
          description: assessSoilDescription,
          appliedFor: {
            quantity: 1.6108,
            unit: 'HA'
          },
          rate: 6.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          parcelName: '',
          code: 'CLIG3',
          description: manageGrasslandDescription,
          appliedFor: {
            quantity: 1.6108,
            unit: 'HA'
          },
          rate: 151.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          parcelName: '',
          code: 'CHRW3',
          description: manageHedgerowTreesDescription,
          appliedFor: {
            quantity: 337.0,
            unit: 'Metres'
          },
          rate: 10.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          parcelName: '',
          code: 'CHRW2',
          description: manageHedgerowDescription,
          appliedFor: {
            quantity: 337.0,
            unit: 'Metres'
          },
          rate: 13.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          parcelName: '',
          code: 'CHRW1',
          description: assessHedgerowDescription,
          appliedFor: {
            quantity: 337.0,
            unit: 'Metres'
          },
          rate: 5.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          parcelName: '',
          code: 'BND2',
          description: earthBanksDescription,
          appliedFor: {
            quantity: 374.0,
            unit: 'Metres'
          },
          rate: 11.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          parcelName: '',
          code: 'CHRW2',
          description: manageHedgerowDescription,
          appliedFor: {
            quantity: 640.0,
            unit: 'Metres'
          },
          rate: 13.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          parcelName: '',
          code: 'CSAM1',
          description: assessSoilDescription,
          appliedFor: {
            quantity: 3.1213,
            unit: 'HA'
          },
          rate: 6.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          parcelName: '',
          code: 'CLIG3',
          description: manageGrasslandDescription,
          appliedFor: {
            quantity: 3.1213,
            unit: 'HA'
          },
          rate: 151.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          parcelName: '',
          code: 'BND2',
          description: earthBanksDescription,
          appliedFor: {
            quantity: 430.0,
            unit: 'Metres'
          },
          rate: 11.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          parcelName: '',
          code: 'CHRW3',
          description: manageHedgerowTreesDescription,
          appliedFor: {
            quantity: 230.0,
            unit: 'Metres'
          },
          rate: 10.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          parcelName: '',
          code: 'CHRW1',
          description: assessHedgerowDescription,
          appliedFor: {
            quantity: 640.0,
            unit: 'Metres'
          },
          rate: 5.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645910',
          parcelId: '81',
          parcelName: '',
          code: 'CHRW2',
          description: manageHedgerowDescription,
          appliedFor: {
            quantity: 50.0,
            unit: 'Metres'
          },
          rate: 13.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645910',
          parcelId: '81',
          parcelName: '',
          code: 'CSAM1',
          description: assessSoilDescription,
          appliedFor: {
            quantity: 0.8291,
            unit: 'HA'
          },
          rate: 6.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645910',
          parcelId: '81',
          parcelName: '',
          code: 'CHRW1',
          description: assessHedgerowDescription,
          appliedFor: {
            quantity: 150.0,
            unit: 'Metres'
          },
          rate: 5.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645910',
          parcelId: '81',
          parcelName: '',
          code: 'BND2',
          description: earthBanksDescription,
          appliedFor: {
            quantity: 210.0,
            unit: 'Metres'
          },
          rate: 11.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645913',
          parcelId: '69',
          parcelName: '',
          code: 'BND2',
          description: earthBanksDescription,
          appliedFor: {
            quantity: 165.0,
            unit: 'Metres'
          },
          rate: 11.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645913',
          parcelId: '69',
          parcelName: '',
          code: 'CSAM1',
          description: assessSoilDescription,
          appliedFor: {
            quantity: 0.4016,
            unit: 'HA'
          },
          rate: 6.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645913',
          parcelId: '69',
          parcelName: '',
          code: 'CLIG3',
          description: manageGrasslandDescription,
          appliedFor: {
            quantity: 0.4016,
            unit: 'HA'
          },
          rate: 151.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          parcelName: '',
          code: 'CHRW3',
          description: manageHedgerowTreesDescription,
          appliedFor: {
            quantity: 150.0,
            unit: 'Metres'
          },
          rate: 10.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          parcelName: '',
          code: 'CHRW1',
          description: assessHedgerowDescription,
          appliedFor: {
            quantity: 300.0,
            unit: 'Metres'
          },
          rate: 5.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          parcelName: '',
          code: 'CHRW2',
          description: manageHedgerowDescription,
          appliedFor: {
            quantity: 300.0,
            unit: 'Metres'
          },
          rate: 13.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          parcelName: '',
          code: 'CSAM1',
          description: assessSoilDescription,
          appliedFor: {
            quantity: 2.7771,
            unit: 'HA'
          },
          rate: 6.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          parcelName: '',
          code: 'CLIG3',
          description: manageGrasslandDescription,
          appliedFor: {
            quantity: 2.7771,
            unit: 'HA'
          },
          rate: 151.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          parcelName: '',
          code: 'GRH8',
          description: 'Supplement: Haymaking (late cut)',
          appliedFor: {
            quantity: 9.7091,
            unit: 'HA'
          },
          rate: 187.0,
          startDate,
          endDate
        }
      ]
    }
  },
  {
    notificationMessageId: 'sample-notification-3',
    agreementNumber: 'SFI999999999',
    identifiers: {
      frn: '9999999990',
      sbi: '999999999'
    },
    answers: {
      agreementName: 'Sample Agreement',
      actionApplications: [
        {
          sheetId: 'SO3757',
          parcelId: '3159',
          parcelName: '',
          code: 'CMOR1',
          description: 'Assess moorland and produce a written record',
          appliedFor: {
            quantity: 4.5123,
            unit: 'HA'
          },
          rate: 10.6,
          startDate,
          endDate
        },
        {
          sheetId: 'SO3757',
          parcelId: '3159',
          parcelName: '',
          code: 'UPL3',
          description: 'Limited livestock grazing on moorland',
          appliedFor: {
            quantity: 3.5125,
            unit: 'HA'
          },
          rate: 66.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SO3757',
          parcelId: '3159',
          parcelName: '',
          code: 'UPL4',
          description:
            'Keep cattle and ponies on moorland supplement (minimum 30% GLU)',
          appliedFor: {
            quantity: 3.5125,
            unit: 'HA'
          },
          rate: 7.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SO3757',
          parcelId: '3159',
          parcelName: '',
          code: 'SPM5',
          description:
            'Keep native breeds on extensively managed habitats supplement (more than 80%)',
          appliedFor: {
            quantity: 3.5125,
            unit: 'HA'
          },
          rate: 11.0,
          startDate,
          endDate
        },
        {
          sheetId: 'SO3757',
          parcelId: '3159',
          parcelName: '',
          code: 'UPL10',
          description:
            'Shepherding livestock on moorland (remove stock for at least 8 months)',
          appliedFor: {
            quantity: 8.3405,
            unit: 'HA'
          },
          rate: 48.0,
          startDate,
          endDate
        }
      ]
    }
  }
]
