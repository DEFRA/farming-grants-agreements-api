const startDate = '2024-11-01'
const endDate = '2027-10-31'
const assessHedgerowDescription = 'CHRW1: Assess and record hedgerow condition'
const assessSoilDescription =
  'CSAM1: Assess soil, produce a soil management plan and test soil organic matter'
const manageGrasslandDescription =
  'CLIG3: Manage grassland with very low nutrient inputs - outside SDAs or within SDAs'
const earthBanksDescription =
  'BND2: Maintain earth banks or stone-faced hedgebanks'
const manageHedgerowDescription = 'CHRW2: Manage hedgerows'
const manageHedgerowTreesDescription =
  'CHRW3: Maintain or establish hedgerow trees'

export default [
  {
    notificationMessageId: 'sample-notification-1',
    agreementNumber: 'SFI123456789',
    clientRef: 'client-ref-001',
    code: 'frps-private-beta',
    identifiers: {
      frn: '1234567890',
      sbi: '106284736',
      crn: 'crn',
      defraId: 'defraId'
    },
    answers: {
      agreementName: 'Sample Agreement',
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
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          code: 'CLIG3',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          code: 'BND2',
          appliedFor: {
            quantity: 234,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          code: 'CHRW2',
          appliedFor: {
            quantity: 207,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX635990',
          parcelId: '44',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX635991',
          parcelId: '73',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX635991',
          parcelId: '73',
          code: 'CHRW2',
          appliedFor: {
            quantity: 265,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX635991',
          parcelId: '73',
          code: 'CHRW1',
          appliedFor: {
            quantity: 265,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX635991',
          parcelId: '73',
          code: 'BND2',
          appliedFor: {
            quantity: 265,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          code: 'CSAM1',
          appliedFor: {
            quantity: 1.6108,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          code: 'CLIG3',
          appliedFor: {
            quantity: 1.6108,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          code: 'CHRW3',
          appliedFor: {
            quantity: 337,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          code: 'CHRW2',
          appliedFor: {
            quantity: 337,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          code: 'CHRW1',
          appliedFor: {
            quantity: 337,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX635995',
          parcelId: '555',
          code: 'BND2',
          appliedFor: {
            quantity: 374,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          code: 'CHRW2',
          appliedFor: {
            quantity: 640,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          code: 'CSAM1',
          appliedFor: {
            quantity: 3.1213,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          code: 'CLIG3',
          appliedFor: {
            quantity: 3.1213,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          code: 'BND2',
          appliedFor: {
            quantity: 430,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          code: 'CHRW3',
          appliedFor: {
            quantity: 230,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645908',
          parcelId: '58',
          code: 'CHRW1',
          appliedFor: {
            quantity: 640,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645910',
          parcelId: '81',
          code: 'CHRW2',
          appliedFor: {
            quantity: 50,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645910',
          parcelId: '81',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.8291,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX645910',
          parcelId: '81',
          code: 'CHRW1',
          appliedFor: {
            quantity: 150,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645910',
          parcelId: '81',
          code: 'BND2',
          appliedFor: {
            quantity: 210,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645913',
          parcelId: '69',
          code: 'BND2',
          appliedFor: {
            quantity: 165,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645913',
          parcelId: '69',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.4016,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX645913',
          parcelId: '69',
          code: 'CLIG3',
          appliedFor: {
            quantity: 0.4016,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          code: 'CHRW3',
          appliedFor: {
            quantity: 150,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          code: 'CHRW1',
          appliedFor: {
            quantity: 300,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          code: 'CHRW2',
          appliedFor: {
            quantity: 300,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          code: 'CSAM1',
          appliedFor: {
            quantity: 2.7771,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          code: 'CLIG3',
          appliedFor: {
            quantity: 2.7771,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SX645926',
          parcelId: '61',
          code: 'GRH8',
          appliedFor: {
            quantity: 9.7091,
            unit: 'ha'
          }
        }
      ],
      payment: {
        agreementStartDate: startDate,
        agreementEndDate: endDate,
        frequency: 'Quarterly',
        agreementTotalPence: 11270784,
        annualTotalPence: 6440448,
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
            description: assessHedgerowDescription,
            version: 1,
            unit: 'metres',
            quantity: 207,
            rateInPence: 500,
            annualPaymentPence: 949500,
            sheetId: 'SX635990',
            parcelId: '44'
          },
          3: {
            code: 'CSAM1',
            description: assessSoilDescription,
            version: 1,
            unit: 'ha',
            quantity: 0.7287,
            rateInPence: 600,
            annualPaymentPence: 6556,
            sheetId: 'SX635990',
            parcelId: '44'
          },
          4: {
            code: 'CLIG3',
            description: manageGrasslandDescription,
            version: 1,
            unit: 'ha',
            quantity: 0.7287,
            rateInPence: 15100,
            annualPaymentPence: 130456,
            sheetId: 'SX635990',
            parcelId: '44'
          },
          5: {
            code: 'BND2',
            description: earthBanksDescription,
            version: 1,
            unit: 'metres',
            quantity: 234,
            rateInPence: 1100,
            annualPaymentPence: 1845800,
            sheetId: 'SX635990',
            parcelId: '44'
          },
          6: {
            code: 'CHRW2',
            description: manageHedgerowDescription,
            version: 1,
            unit: 'metres',
            quantity: 207,
            rateInPence: 1300,
            annualPaymentPence: 2338700,
            sheetId: 'SX635990',
            parcelId: '44'
          },
          7: {
            code: 'CHRW3',
            description: manageHedgerowTreesDescription,
            version: 1,
            unit: 'metres',
            quantity: 337,
            rateInPence: 1000,
            annualPaymentPence: 717000,
            sheetId: 'SX635995',
            parcelId: '555'
          },
          8: {
            code: 'GRH8',
            description: 'Supplement: Haymaking (late cut)',
            version: 1,
            unit: 'ha',
            quantity: 9.7091,
            rateInPence: 18700,
            annualPaymentPence: 181560,
            sheetId: 'SX645926',
            parcelId: '61'
          }
        },
        agreementLevelItems: {
          1: {
            code: 'CSAM1',
            description: assessSoilDescription,
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
                agreementLevelItemId: 1,
                paymentPence: 6800
              },
              {
                parcelItemId: 1,
                paymentPence: 60919
              },
              {
                parcelItemId: 2,
                paymentPence: 237375
              },
              {
                parcelItemId: 3,
                paymentPence: 1639
              },
              {
                parcelItemId: 4,
                paymentPence: 32614
              },
              {
                parcelItemId: 5,
                paymentPence: 461450
              },
              {
                parcelItemId: 6,
                paymentPence: 584675
              },
              {
                parcelItemId: 7,
                paymentPence: 179250
              },
              {
                parcelItemId: 8,
                paymentPence: 45390
              }
            ]
          },
          {
            totalPaymentPence: 1610112,
            paymentDate: '2026-03-05',
            lineItems: [
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              },
              {
                parcelItemId: 1,
                paymentPence: 60919
              },
              {
                parcelItemId: 2,
                paymentPence: 237375
              },
              {
                parcelItemId: 3,
                paymentPence: 1639
              },
              {
                parcelItemId: 4,
                paymentPence: 32614
              },
              {
                parcelItemId: 5,
                paymentPence: 461450
              },
              {
                parcelItemId: 6,
                paymentPence: 584675
              },
              {
                parcelItemId: 7,
                paymentPence: 179250
              },
              {
                parcelItemId: 8,
                paymentPence: 45390
              }
            ]
          },
          {
            totalPaymentPence: 1610112,
            paymentDate: '2026-06-05',
            lineItems: [
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              },
              {
                parcelItemId: 1,
                paymentPence: 60919
              },
              {
                parcelItemId: 2,
                paymentPence: 237375
              },
              {
                parcelItemId: 3,
                paymentPence: 1639
              },
              {
                parcelItemId: 4,
                paymentPence: 32614
              },
              {
                parcelItemId: 5,
                paymentPence: 461450
              },
              {
                parcelItemId: 6,
                paymentPence: 584675
              },
              {
                parcelItemId: 7,
                paymentPence: 179250
              },
              {
                parcelItemId: 8,
                paymentPence: 45390
              }
            ]
          },
          {
            totalPaymentPence: 1610112,
            paymentDate: '2026-09-05',
            lineItems: [
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              },
              {
                parcelItemId: 1,
                paymentPence: 60919
              },
              {
                parcelItemId: 2,
                paymentPence: 237375
              },
              {
                parcelItemId: 3,
                paymentPence: 1639
              },
              {
                parcelItemId: 4,
                paymentPence: 32614
              },
              {
                parcelItemId: 5,
                paymentPence: 461450
              },
              {
                parcelItemId: 6,
                paymentPence: 584675
              },
              {
                parcelItemId: 7,
                paymentPence: 179250
              },
              {
                parcelItemId: 8,
                paymentPence: 45390
              }
            ]
          },
          {
            totalPaymentPence: 1610112,
            paymentDate: '2026-12-05',
            lineItems: [
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              },
              {
                parcelItemId: 1,
                paymentPence: 60919
              },
              {
                parcelItemId: 2,
                paymentPence: 237375
              },
              {
                parcelItemId: 3,
                paymentPence: 1639
              },
              {
                parcelItemId: 4,
                paymentPence: 32614
              },
              {
                parcelItemId: 5,
                paymentPence: 461450
              },
              {
                parcelItemId: 6,
                paymentPence: 584675
              },
              {
                parcelItemId: 7,
                paymentPence: 179250
              },
              {
                parcelItemId: 8,
                paymentPence: 45390
              }
            ]
          },
          {
            totalPaymentPence: 1610112,
            paymentDate: '2027-03-05',
            lineItems: [
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              },
              {
                parcelItemId: 1,
                paymentPence: 60919
              },
              {
                parcelItemId: 2,
                paymentPence: 237375
              },
              {
                parcelItemId: 3,
                paymentPence: 1639
              },
              {
                parcelItemId: 4,
                paymentPence: 32614
              },
              {
                parcelItemId: 5,
                paymentPence: 461450
              },
              {
                parcelItemId: 6,
                paymentPence: 584675
              },
              {
                parcelItemId: 7,
                paymentPence: 179250
              },
              {
                parcelItemId: 8,
                paymentPence: 45390
              }
            ]
          },
          {
            totalPaymentPence: 1610112,
            paymentDate: '2027-06-05',
            lineItems: [
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              },
              {
                parcelItemId: 1,
                paymentPence: 60919
              },
              {
                parcelItemId: 2,
                paymentPence: 237375
              },
              {
                parcelItemId: 3,
                paymentPence: 1639
              },
              {
                parcelItemId: 4,
                paymentPence: 32614
              },
              {
                parcelItemId: 5,
                paymentPence: 461450
              },
              {
                parcelItemId: 6,
                paymentPence: 584675
              },
              {
                parcelItemId: 7,
                paymentPence: 179250
              },
              {
                parcelItemId: 8,
                paymentPence: 45390
              }
            ]
          }
        ]
      },
      applicant: {
        business: {
          name: 'J&S Hartley',
          email: {
            address:
              'cliffspencetasabbeyfarmf@mrafyebbasatecnepsffilcm.com.test'
          },
          phone: {
            mobile: '01234031670'
          },
          address: {
            line1: 'Mason House Farm Clitheroe Rd',
            line2: 'Bashall Eaves',
            line3: null,
            line4: null,
            line5: null,
            street: 'Bartindale Road',
            city: 'Clitheroe',
            postalCode: 'BB7 3DD'
          }
        },
        customer: {
          name: {
            title: 'Mr.',
            first: 'Edward',
            middle: 'Paul',
            last: 'Jones'
          }
        }
      }
    }
  },
  {
    notificationMessageId: 'sample-notification-2',
    agreementNumber: 'SFI987654321',
    clientRef: 'client-ref-002',
    code: 'frps-private-beta',
    createdAt: '2025-08-19T09:36:45.131Z',
    submittedAt: '2025-08-19T09:36:44.509Z',
    identifiers: {
      sbi: '106284736',
      frn: 'frn',
      crn: 'crn',
      defraId: 'defraId'
    },
    answers: {
      hasCheckedLandIsUpToDate: true,
      agreementName: 'NO_LONGER_REQUIRED',
      scheme: 'SFI',
      year: 2025,
      actionApplications: [
        {
          code: 'CMOR1',
          sheetId: 'SD6743',
          parcelId: '8083',
          appliedFor: {
            unit: 'ha',
            quantity: 4.53411078
          }
        }
      ],
      payment: {
        agreementStartDate: '2025-09-01',
        agreementEndDate: '2028-09-01',
        frequency: 'Quarterly',
        agreementTotalPence: 96018,
        annualTotalPence: 32006,
        parcelItems: {
          1: {
            code: 'CMOR1',
            description: 'CMOR1: Assess moorland and produce a written record',
            version: 1,
            unit: 'ha',
            quantity: 4.53411078,
            rateInPence: 1060,
            annualPaymentPence: 4806,
            sheetId: 'SD6743',
            parcelId: '8083'
          }
        },
        agreementLevelItems: {
          1: {
            code: 'CMOR1',
            description: 'CMOR1: Assess moorland and produce a written record',
            version: 1,
            annualPaymentPence: 27200
          }
        },
        payments: [
          {
            totalPaymentPence: 8007,
            paymentDate: '2025-12-05',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          },
          {
            totalPaymentPence: 8001,
            paymentDate: '2026-03-05',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          },
          {
            totalPaymentPence: 8001,
            paymentDate: '2026-06-05',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          },
          {
            totalPaymentPence: 8001,
            paymentDate: '2026-09-07',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          },
          {
            totalPaymentPence: 8001,
            paymentDate: '2026-12-07',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          },
          {
            totalPaymentPence: 8001,
            paymentDate: '2027-03-05',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          },
          {
            totalPaymentPence: 8001,
            paymentDate: '2027-06-07',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          },
          {
            totalPaymentPence: 8001,
            paymentDate: '2027-09-06',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          },
          {
            totalPaymentPence: 8001,
            paymentDate: '2027-12-06',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          },
          {
            totalPaymentPence: 8001,
            paymentDate: '2028-03-06',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          },
          {
            totalPaymentPence: 8001,
            paymentDate: '2028-06-05',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          },
          {
            totalPaymentPence: 8001,
            paymentDate: '2028-09-05',
            lineItems: [
              {
                parcelItemId: 1,
                paymentPence: 1201
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6800
              }
            ]
          }
        ]
      },
      applicant: {
        business: {
          name: 'J&S Hartley',
          email: {
            address:
              'cliffspencetasabbeyfarmf@mrafyebbasatecnepsffilcm.com.test'
          },
          phone: {
            mobile: '01234031670'
          },
          address: {
            line1: 'Mason House Farm Clitheroe Rd',
            line2: 'Bashall Eaves',
            line3: null,
            line4: null,
            line5: null,
            street: 'Bartindale Road',
            city: 'Clitheroe',
            postalCode: 'BB7 3DD'
          }
        },
        customer: {
          name: {
            title: 'Mr.',
            first: 'Edward',
            middle: 'Paul',
            last: 'Jones'
          }
        }
      }
    }
  }
]
