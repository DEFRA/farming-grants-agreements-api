const startDate = '2024-11-01'
const endDate = '2027-10-31'
const assessHedgerowDescription = 'OFM3: Assess and record hedgerow condition'
const assessSoilDescription =
  'CSAM1: Assess soil, produce a soil management plan and test soil organic matter'
const manageGrasslandDescription =
  'UPL1: Manage grassland with very low nutrient inputs - outside SDAs or within SDAs'
const earthBanksDescription =
  'UPL2: Maintain earth banks or stone-faced hedgebanks'
const manageHedgerowDescription = 'SPM4: Manage hedgerows'
const manageHedgerowTreesDescription =
  'SAM1: Maintain or establish hedgerow trees'

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
      agreementName: 'Example agreement 1',
      actionApplications: [
        {
          sheetId: 'SD4841',
          parcelId: '4684',
          code: 'SPM4',
          appliedFor: {
            quantity: 95,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4841',
          parcelId: '4684',
          code: 'OFM3',
          appliedFor: {
            quantity: 207,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4841',
          parcelId: '4684',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4841',
          parcelId: '4684',
          code: 'UPL1',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4841',
          parcelId: '4684',
          code: 'UPL2',
          appliedFor: {
            quantity: 234,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4841',
          parcelId: '4684',
          code: 'SPM4',
          appliedFor: {
            quantity: 207,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4841',
          parcelId: '4684',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4842',
          parcelId: '3020',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4842',
          parcelId: '3020',
          code: 'SPM4',
          appliedFor: {
            quantity: 265,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4842',
          parcelId: '3020',
          code: 'OFM3',
          appliedFor: {
            quantity: 265,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4842',
          parcelId: '3020',
          code: 'UPL2',
          appliedFor: {
            quantity: 265,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4843',
          parcelId: '4672',
          code: 'CSAM1',
          appliedFor: {
            quantity: 1.6108,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4843',
          parcelId: '4672',
          code: 'UPL1',
          appliedFor: {
            quantity: 1.6108,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4843',
          parcelId: '4672',
          code: 'SAM1',
          appliedFor: {
            quantity: 337,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4843',
          parcelId: '4672',
          code: 'SPM4',
          appliedFor: {
            quantity: 337,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4843',
          parcelId: '4672',
          code: 'OFM3',
          appliedFor: {
            quantity: 337,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4843',
          parcelId: '4672',
          code: 'UPL2',
          appliedFor: {
            quantity: 374,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4844',
          parcelId: '2451',
          code: 'SPM4',
          appliedFor: {
            quantity: 640,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4844',
          parcelId: '2451',
          code: 'CSAM1',
          appliedFor: {
            quantity: 3.1213,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4844',
          parcelId: '2451',
          code: 'UPL1',
          appliedFor: {
            quantity: 3.1213,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4844',
          parcelId: '2451',
          code: 'UPL2',
          appliedFor: {
            quantity: 430,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4844',
          parcelId: '2451',
          code: 'SAM1',
          appliedFor: {
            quantity: 230,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4844',
          parcelId: '2451',
          code: 'OFM3',
          appliedFor: {
            quantity: 640,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4845',
          parcelId: '3744',
          code: 'SPM4',
          appliedFor: {
            quantity: 50,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4845',
          parcelId: '3744',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.8291,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4845',
          parcelId: '3744',
          code: 'OFM3',
          appliedFor: {
            quantity: 150,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4845',
          parcelId: '3744',
          code: 'UPL2',
          appliedFor: {
            quantity: 210,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4846',
          parcelId: '3511',
          code: 'UPL2',
          appliedFor: {
            quantity: 165,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4846',
          parcelId: '3511',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.4016,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4846',
          parcelId: '3511',
          code: 'UPL1',
          appliedFor: {
            quantity: 0.4016,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4847',
          parcelId: '6801',
          code: 'SAM1',
          appliedFor: {
            quantity: 150,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4847',
          parcelId: '6801',
          code: 'OFM3',
          appliedFor: {
            quantity: 300,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4847',
          parcelId: '6801',
          code: 'SPM4',
          appliedFor: {
            quantity: 300,
            unit: 'metres'
          }
        },
        {
          sheetId: 'SD4847',
          parcelId: '6801',
          code: 'CSAM1',
          appliedFor: {
            quantity: 2.7771,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4847',
          parcelId: '6801',
          code: 'UPL1',
          appliedFor: {
            quantity: 2.7771,
            unit: 'ha'
          }
        },
        {
          sheetId: 'SD4847',
          parcelId: '6801',
          code: 'OFM3',
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
        agreementTotalPence: 11270793,
        annualTotalPence: 6440448,
        parcelItems: {
          1: {
            code: 'SPM4',
            description: 'Maintain dry stone walls',
            version: 1,
            unit: 'metres',
            quantity: 95,
            rateInPence: 2565,
            annualPaymentPence: 243675,
            sheetId: 'SD4841',
            parcelId: '44'
          },
          2: {
            code: 'OFM3',
            description: assessHedgerowDescription,
            version: 1,
            unit: 'metres',
            quantity: 207,
            rateInPence: 500,
            annualPaymentPence: 949500,
            sheetId: 'SD4841',
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
            sheetId: 'SD4841',
            parcelId: '44'
          },
          4: {
            code: 'UPL1',
            description: manageGrasslandDescription,
            version: 1,
            unit: 'ha',
            quantity: 0.7287,
            rateInPence: 15100,
            annualPaymentPence: 130456,
            sheetId: 'SD4841',
            parcelId: '44'
          },
          5: {
            code: 'UPL2',
            description: earthBanksDescription,
            version: 1,
            unit: 'metres',
            quantity: 234,
            rateInPence: 1100,
            annualPaymentPence: 1845800,
            sheetId: 'SD4841',
            parcelId: '44'
          },
          6: {
            code: 'SPM4',
            description: manageHedgerowDescription,
            version: 1,
            unit: 'metres',
            quantity: 207,
            rateInPence: 1300,
            annualPaymentPence: 2338700,
            sheetId: 'SD4841',
            parcelId: '44'
          },
          7: {
            code: 'SAM1',
            description: manageHedgerowTreesDescription,
            version: 1,
            unit: 'metres',
            quantity: 337,
            rateInPence: 1000,
            annualPaymentPence: 717000,
            sheetId: 'SD4843',
            parcelId: '555'
          },
          8: {
            code: 'OFM3',
            description: 'Supplement: Haymaking (late cut)',
            version: 1,
            unit: 'ha',
            quantity: 9.7091,
            rateInPence: 18700,
            annualPaymentPence: 181560,
            sheetId: 'SD4847',
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
            totalPaymentPence: 1610119,
            paymentDate: '2025-12-05',
            lineItems: [
              {
                agreementLevelItemId: 1,
                paymentPence: 6801
              },
              {
                parcelItemId: 1,
                paymentPence: 60920
              },
              {
                parcelItemId: 2,
                paymentPence: 237376
              },
              {
                parcelItemId: 3,
                paymentPence: 1640
              },
              {
                parcelItemId: 4,
                paymentPence: 32615
              },
              {
                parcelItemId: 5,
                paymentPence: 461451
              },
              {
                parcelItemId: 6,
                paymentPence: 584676
              },
              {
                parcelItemId: 7,
                paymentPence: 179251
              },
              {
                parcelItemId: 8,
                paymentPence: 45391
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
      },
      application: {
        parcel: [
          {
            sheetId: 'SD6743',
            parcelId: '8083',
            area: {
              unit: 'ha',
              quantity: 5.2182,
              _id: '69262bb2331fd3b45b76ee92'
            },
            actions: [
              {
                code: 'CMOR1',
                version: 1,
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 4.7575,
                  _id: '69262bb2331fd3b45b76ee94'
                },
                _id: '69262bb2331fd3b45b76ee93'
              },
              {
                code: 'UPL3',
                version: 1,
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 4.7575,
                  _id: '69262bb2331fd3b45b76ee96'
                },
                _id: '69262bb2331fd3b45b76ee95'
              }
            ],
            _id: '69262bb2331fd3b45b76ee91'
          },
          {
            sheetId: 'SD4842',
            parcelId: '4495',
            area: {
              unit: 'ha',
              quantity: 2.1703,
              _id: '69262bb2331fd3b45b76ee98'
            },
            actions: [
              {
                code: 'CMOR1',
                version: 1,
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 2.1705,
                  _id: '69262bb2331fd3b45b76ee9a'
                },
                _id: '69262bb2331fd3b45b76ee99'
              },
              {
                code: 'UPL1',
                version: 1,
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 2.1705,
                  _id: '69262bb2331fd3b45b76ee9c'
                },
                _id: '69262bb2331fd3b45b76ee9b'
              }
            ],
            _id: '69262bb2331fd3b45b76ee97'
          }
        ],
        agreement: [],
        _id: '69262bb2331fd3b45b76ee90'
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
      crn: 'crn'
    },
    answers: {
      hasCheckedLandIsUpToDate: true,
      agreementName: 'Example agreement 2',
      scheme: 'SFI',
      year: 2025,
      actionApplications: [],
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
                paymentPence: 1204
              },
              {
                agreementLevelItemId: 1,
                paymentPence: 6803
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
      },
      application: {
        parcel: [
          {
            sheetId: 'SD6743',
            parcelId: '8083',
            area: {
              unit: 'ha',
              quantity: 5.2182,
              _id: '69262bb2331fd3b45b76ee92'
            },
            actions: [
              {
                code: 'CMOR1',
                version: 1,
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 4.7575,
                  _id: '69262bb2331fd3b45b76ee94'
                },
                _id: '69262bb2331fd3b45b76ee93'
              }
            ],
            _id: '69262bb2331fd3b45b76ee91'
          },
          {
            sheetId: 'SD6743',
            parcelId: '8333',
            area: {
              unit: 'ha',
              quantity: 2.1703,
              _id: '69262bb2331fd3b45b76ee98'
            },
            actions: [
              {
                code: 'CMOR1',
                version: 1,
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 2.1705,
                  _id: '69262bb2331fd3b45b76ee9a'
                },
                _id: '69262bb2331fd3b45b76ee99'
              }
            ],
            _id: '69262bb2331fd3b45b76ee97'
          }
        ],
        agreement: [],
        _id: '69262bb2331fd3b45b76ee90'
      }
    }
  }
]
