/**
 * Canonical WMP "create agreement" payload as forwarded from GAS.
 *
 * Notes:
 * - `code: 'woodland'` is the canonical WMP signal (case-insensitive).
 * - Identifiers live at the top level; `metadata` is empty on the wire.
 * - WMP carries optional payment info on `answers.payments.agreement[]`.
 *   When present, the persisted version's `payment` is built from it
 *   (frequency `OneOff`, paid on signature). landParcels are not part
 *   of the WMP create payload — `application.parcel[]` stays empty.
 * - `applicant.business.email` / `.phone` are objects, not strings.
 */
const wmpAgreement = {
  clientRef: 'wmp-926-wlw',
  code: 'woodland',
  identifiers: { sbi: '107593059', frn: '1076543210', crn: '1100957269' },
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
    totalHectaresAppliedFor: 195.246,
    hectaresTenOrOverYearsOld: 18,
    hectaresUnderTenYearsOld: 2,
    landParcels: [
      { parcelId: 'SD7560-9193', areaHa: 25.3874 },
      { parcelId: 'SD5848-9205', areaHa: 169.8586 }
    ],
    centreGridReference: 'SP12345678',
    fcTeamCode: 'NORTH_WEST_AND_WEST_MIDLANDS',
    applicant: {
      business: {
        name: 'Taylor Equestrian Yards',
        reference: '1076543210',
        email: { address: 'oliver.taylor@taylorequestrian.test' },
        phone: { mobile: '07700900123' },
        address: {
          line1: 'Taylor Equestrian Yards',
          line2: 'Riding Lane',
          line3: null,
          line4: null,
          line5: null,
          street: 'Riding Lane',
          city: 'Cambridge',
          postalCode: 'CB1 2AB'
        },
        vat: 'GB987654321',
        type: { code: '1', type: 'Sole Trader' }
      },
      countyParishHoldings: '23/456/7890',
      customer: {
        name: { title: 'Mr', first: 'Oliver', middle: 'J', last: 'Taylor' }
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
