/**
 * Canonical WMP "create agreement" payload as forwarded from GAS.
 *
 * Notes:
 * - `code: 'woodland'` is the canonical WMP signal (case-insensitive).
 * - Identifiers live at the top level; `metadata` is empty on the wire.
 * - WMP carries optional payment info on `answers.payments.agreement[]`.
 *   When present, the persisted version's `payment` is built from it
 *   (frequency `OneOff`, paid on signature). Agreement dates stay unset
 *   until Land Grants calculates them on acceptance.
 * - `applicant.business.email` / `.phone` are objects, not strings.
 */
const wmpAgreement = {
  clientRef: 'wmp-example-302',
  code: 'woodland',
  identifiers: { sbi: '900000201', frn: '9100000201', crn: '9000000202' },
  metadata: {},
  answers: {
    referenceNumber: 'WMP-926-WLW',
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
  }
}

export default wmpAgreement
