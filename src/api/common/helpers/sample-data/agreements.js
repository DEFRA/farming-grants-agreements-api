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
    agreementNumber: 'FPTT123456789',
    clientRef: 'client-ref-001',
    code: 'frps-private-beta',
    identifiers: {
      frn: '1234567890',
      sbi: '900000005',
      crn: 'crn',
      defraId: 'defraId'
    },
    answers: {
      agreementName: 'Example agreement 1',
      scheme: 'FPTT',
      actionApplications: [
        {
          sheetId: 'AA0100',
          parcelId: '0110',
          code: 'SPM4',
          appliedFor: {
            quantity: 95,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0100',
          parcelId: '0110',
          code: 'OFM3',
          appliedFor: {
            quantity: 207,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0100',
          parcelId: '0110',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0100',
          parcelId: '0110',
          code: 'UPL1',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0100',
          parcelId: '0110',
          code: 'UPL2',
          appliedFor: {
            quantity: 234,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0100',
          parcelId: '0110',
          code: 'SPM4',
          appliedFor: {
            quantity: 207,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0100',
          parcelId: '0110',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0101',
          parcelId: '0104',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.7287,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0101',
          parcelId: '0104',
          code: 'SPM4',
          appliedFor: {
            quantity: 265,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0101',
          parcelId: '0104',
          code: 'OFM3',
          appliedFor: {
            quantity: 265,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0101',
          parcelId: '0104',
          code: 'UPL2',
          appliedFor: {
            quantity: 265,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0102',
          parcelId: '0109',
          code: 'CSAM1',
          appliedFor: {
            quantity: 1.6108,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0102',
          parcelId: '0109',
          code: 'UPL1',
          appliedFor: {
            quantity: 1.6108,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0102',
          parcelId: '0109',
          code: 'SAM1',
          appliedFor: {
            quantity: 337,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0102',
          parcelId: '0109',
          code: 'SPM4',
          appliedFor: {
            quantity: 337,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0102',
          parcelId: '0109',
          code: 'OFM3',
          appliedFor: {
            quantity: 337,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0102',
          parcelId: '0109',
          code: 'UPL2',
          appliedFor: {
            quantity: 374,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0103',
          parcelId: '0102',
          code: 'SPM4',
          appliedFor: {
            quantity: 640,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0103',
          parcelId: '0102',
          code: 'CSAM1',
          appliedFor: {
            quantity: 3.1213,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0103',
          parcelId: '0102',
          code: 'UPL1',
          appliedFor: {
            quantity: 3.1213,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0103',
          parcelId: '0102',
          code: 'UPL2',
          appliedFor: {
            quantity: 430,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0103',
          parcelId: '0102',
          code: 'SAM1',
          appliedFor: {
            quantity: 230,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0103',
          parcelId: '0102',
          code: 'OFM3',
          appliedFor: {
            quantity: 640,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0104',
          parcelId: '0106',
          code: 'SPM4',
          appliedFor: {
            quantity: 50,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0104',
          parcelId: '0106',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.8291,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0104',
          parcelId: '0106',
          code: 'OFM3',
          appliedFor: {
            quantity: 150,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0104',
          parcelId: '0106',
          code: 'UPL2',
          appliedFor: {
            quantity: 210,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0105',
          parcelId: '0105',
          code: 'UPL2',
          appliedFor: {
            quantity: 165,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0105',
          parcelId: '0105',
          code: 'CSAM1',
          appliedFor: {
            quantity: 0.4016,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0105',
          parcelId: '0105',
          code: 'UPL1',
          appliedFor: {
            quantity: 0.4016,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0106',
          parcelId: '0113',
          code: 'SAM1',
          appliedFor: {
            quantity: 150,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0106',
          parcelId: '0113',
          code: 'OFM3',
          appliedFor: {
            quantity: 300,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0106',
          parcelId: '0113',
          code: 'SPM4',
          appliedFor: {
            quantity: 300,
            unit: 'metres'
          }
        },
        {
          sheetId: 'AA0106',
          parcelId: '0113',
          code: 'CSAM1',
          appliedFor: {
            quantity: 2.7771,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0106',
          parcelId: '0113',
          code: 'UPL1',
          appliedFor: {
            quantity: 2.7771,
            unit: 'ha'
          }
        },
        {
          sheetId: 'AA0106',
          parcelId: '0113',
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
            version: '1',
            unit: 'metres',
            quantity: 95,
            rateInPence: 2565,
            annualPaymentPence: 243675,
            sheetId: 'AA0100',
            parcelId: '44'
          },
          2: {
            code: 'OFM3',
            description: assessHedgerowDescription,
            version: '1',
            unit: 'metres',
            quantity: 207,
            rateInPence: 500,
            annualPaymentPence: 949500,
            sheetId: 'AA0100',
            parcelId: '44'
          },
          3: {
            code: 'CSAM1',
            description: assessSoilDescription,
            version: '1',
            unit: 'ha',
            quantity: 0.7287,
            rateInPence: 600,
            annualPaymentPence: 6556,
            sheetId: 'AA0100',
            parcelId: '44'
          },
          4: {
            code: 'UPL1',
            description: manageGrasslandDescription,
            version: '1',
            unit: 'ha',
            quantity: 0.7287,
            rateInPence: 15100,
            annualPaymentPence: 130456,
            sheetId: 'AA0100',
            parcelId: '44'
          },
          5: {
            code: 'UPL2',
            description: earthBanksDescription,
            version: '1',
            unit: 'metres',
            quantity: 234,
            rateInPence: 1100,
            annualPaymentPence: 1845800,
            sheetId: 'AA0100',
            parcelId: '44'
          },
          6: {
            code: 'SPM4',
            description: manageHedgerowDescription,
            version: '1',
            unit: 'metres',
            quantity: 207,
            rateInPence: 1300,
            annualPaymentPence: 2338700,
            sheetId: 'AA0100',
            parcelId: '44'
          },
          7: {
            code: 'SAM1',
            description: manageHedgerowTreesDescription,
            version: '1',
            unit: 'metres',
            quantity: 337,
            rateInPence: 1000,
            annualPaymentPence: 717000,
            sheetId: 'AA0102',
            parcelId: '555'
          },
          8: {
            code: 'OFM3',
            description: 'Supplement: Haymaking (late cut)',
            version: '1',
            unit: 'ha',
            quantity: 9.7091,
            rateInPence: 18700,
            annualPaymentPence: 181560,
            sheetId: 'AA0106',
            parcelId: '61'
          }
        },
        agreementLevelItems: {
          1: {
            code: 'CSAM1',
            description: assessSoilDescription,
            version: '1',
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
          name: 'Example Ridge Farm Ltd',
          address: {
            line1: '3 Example Lane',
            line2: 'Example Village',
            line3: null,
            line4: null,
            line5: null,
            street: 'Example Lane',
            city: 'Exampleton',
            postalCode: 'ZZ99 3ZZ'
          }
        },
        customer: {
          name: {
            title: 'Mr.',
            first: 'Jamie',
            middle: 'Test',
            last: 'Sample'
          }
        }
      },
      application: {
        parcel: [
          {
            sheetId: 'AA0006',
            parcelId: '0006',
            area: {
              unit: 'ha',
              quantity: 5.2182,
              _id: 'f00000000000000000000003'
            },
            actions: [
              {
                code: 'CMOR1',
                version: '1',
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 4.7575,
                  _id: 'f00000000000000000000005'
                },
                _id: 'f00000000000000000000004'
              },
              {
                code: 'UPL3',
                version: '1',
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 4.7575,
                  _id: 'f00000000000000000000021'
                },
                _id: 'f00000000000000000000020'
              }
            ],
            _id: 'f00000000000000000000002'
          },
          {
            sheetId: 'AA0101',
            parcelId: '0108',
            area: {
              unit: 'ha',
              quantity: 2.1703,
              _id: 'f00000000000000000000007'
            },
            actions: [
              {
                code: 'CMOR1',
                version: '1',
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 2.1705,
                  _id: 'f00000000000000000000009'
                },
                _id: 'f00000000000000000000008'
              },
              {
                code: 'UPL1',
                version: '1',
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 2.1705,
                  _id: 'f00000000000000000000023'
                },
                _id: 'f00000000000000000000022'
              }
            ],
            _id: 'f00000000000000000000006'
          }
        ],
        agreement: [],
        _id: 'f00000000000000000000001'
      }
    }
  },
  {
    clientRef: 'wmp-example-302',
    code: 'woodland',
    identifiers: { sbi: '900000201', frn: '9100000201', crn: '9000000202' },
    metadata: {},
    answers: {
      referenceNumber: 'WMP-926-WLW',
      woodlandName: 'Oakridge Estate',
      businessDetailsUpToDate: true,
      landRegisteredWithRpa: true,
      landManagementControl: true,
      publicBodyTenant: false,
      landHasGrazingRights: false,
      appLandHasExistingWmp: false,
      intendToApplyHigherTier: true,
      totalHectaresForSelectedParcels: 195.246,
      hectaresTenOrOverYearsOld: 18,
      hectaresUnderTenYearsOld: 2,
      landParcels: [
        { parcelId: 'AA0008-0008', areaHa: 25.3874 },
        { parcelId: 'AA0002-0009', areaHa: 169.8586 }
      ],
      centreGridReference: 'SP12345678',
      fcTeamCode: 'NORTH_WEST_AND_WEST_MIDLANDS',
      applicant: {
        business: {
          name: 'Example Riding Centre',
          reference: '9100000201',
          email: { address: 'riding@example.test' },
          phone: { mobile: '07700900123' },
          address: {
            line1: 'Example Riding Centre',
            line2: 'Example Lane',
            line3: null,
            line4: null,
            line5: null,
            street: 'Example Lane',
            city: 'Cambridge',
            postalCode: 'ZZ99 6ZZ'
          },
          vat: 'GB987654321',
          type: { code: '1', type: 'Sole Trader' }
        },
        countyParishHoldings: '23/456/7890',
        customer: {
          name: { title: 'Mr', first: 'Casey', middle: 'J', last: 'Example' }
        }
      },
      detailsConfirmedAt: '2026-04-02T09:15:33.583Z',
      guidanceRead: true,
      includedAllEligibleWoodland: true,
      applicationConfirmation: true,
      totalAgreementPaymentPence: 166200,
      payments: {
        agreement: [
          {
            code: 'PA3',
            description: 'Woodland management plan',
            activePaymentTier: 2,
            quantityInActiveTier: 5.4,
            activeTierRatePence: 3000,
            activeTierFlatRatePence: 150000,
            quantity: 55.4,
            agreementTotalPence: 166200,
            unit: 'ha'
          }
        ]
      }
    },
    notificationMessageId: 'sample-notification-wmp-1'
  },
  {
    notificationMessageId: 'sample-notification-2',
    agreementNumber: 'FPTT123456789',
    clientRef: 'client-ref-001',
    code: 'frps-private-beta',
    identifiers: {
      frn: '1234567890',
      sbi: '900000005',
      crn: 'crn',
      defraId: 'defraId'
    },
    answers: {
      hasCheckedLandIsUpToDate: true,
      agreementName: 'Example agreement 2',
      scheme: 'FPTT',
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
            version: '1',
            unit: 'ha',
            quantity: 4.53411078,
            rateInPence: 1060,
            annualPaymentPence: 4806,
            sheetId: 'AA0006',
            parcelId: '0006'
          }
        },
        agreementLevelItems: {
          1: {
            code: 'CMOR1',
            description: 'CMOR1: Assess moorland and produce a written record',
            version: '1',
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
          name: 'Example Ridge Farm Ltd',
          address: {
            line1: '3 Example Lane',
            line2: 'Example Village',
            line3: null,
            line4: null,
            line5: null,
            street: 'Example Lane',
            city: 'Exampleton',
            postalCode: 'ZZ99 3ZZ'
          }
        },
        customer: {
          name: {
            title: 'Mr.',
            first: 'Jamie',
            middle: 'Test',
            last: 'Sample'
          }
        }
      },
      application: {
        parcel: [
          {
            sheetId: 'AA0006',
            parcelId: '0006',
            area: {
              unit: 'ha',
              quantity: 5.2182,
              _id: 'f00000000000000000000003'
            },
            actions: [
              {
                code: 'CMOR1',
                version: '1',
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 4.7575,
                  _id: 'f00000000000000000000005'
                },
                _id: 'f00000000000000000000004'
              }
            ],
            _id: 'f00000000000000000000002'
          },
          {
            sheetId: 'AA0006',
            parcelId: '0007',
            area: {
              unit: 'ha',
              quantity: 2.1703,
              _id: 'f00000000000000000000007'
            },
            actions: [
              {
                code: 'CMOR1',
                version: '1',
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 2.1705,
                  _id: 'f00000000000000000000009'
                },
                _id: 'f00000000000000000000008'
              }
            ],
            _id: 'f00000000000000000000006'
          }
        ],
        agreement: [],
        _id: 'f00000000000000000000001'
      }
    }
  }
]
