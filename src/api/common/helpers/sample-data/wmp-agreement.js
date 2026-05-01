/**
 * Canonical WMP "create agreement" payload as forwarded from GAS.
 * Mirrors the example payload in the Jira ticket (FG-XXXX) and is the
 * golden fixture for the WMP Joi schema, payload mapper, integration and
 * pact tests.
 *
 * Notes:
 * - There is no top-level `code` / `scheme` field on the wire today;
 *   detection uses `metadata.clientRef` prefix + WMP-only `answers.*` keys.
 * - `applicant.business.email` and `.phone` are objects (not strings).
 * - `address` carries the full PAF set (uprn, buildingName, flatName, ...).
 * - Action codes are real Forestry Commission plan codes (e.g. `PA3`).
 * - `existingWmps` is a string (not an array) on the real payload.
 * - `totalAgreementPaymentPence` ↔ Σ `payments.agreement[].agreementTotalPence`
 *   must match exactly (cross-field rule in the Joi schema).
 * - `totalHectaresAppliedFor` ↔ Σ `landParcels[].areaHa` must match (±0.01).
 */
const wmpAgreement = {
  metadata: {
    clientRef: 'wmp-92j-b49',
    sbi: '200000001',
    crn: '1200000001',
    frn: '0300000100',
    submittedAt: '2026-04-16T10:08:40.969Z'
  },
  answers: {
    businessDetailsUpToDate: true,
    landRegisteredWithRpa: true,
    landManagementControl: true,
    publicBodyTenant: false,
    landHasGrazingRights: false,
    appLandHasExistingWmp: true,
    existingWmps: 'www',
    intendToApplyHigherTier: true,
    hectaresTenOrOverYearsOld: 42,
    hectaresUnderTenYearsOld: 25,
    centreGridReference: 'SP 4178 2432',
    fcTeamCode: 'SOUTH_WEST',
    applicant: {
      business: {
        name: 'High Fell Farm',
        reference: '0300000100',
        email: { address: 'contact+300000100@example.test' },
        phone: { landline: '02011223344' },
        address: {
          line1: '1 Moorfield',
          line2: 'Glossop',
          line3: 'High Peak',
          line4: 'Derbyshire',
          line5: '',
          street: '1 Moorfield',
          city: 'Chesham',
          postalCode: 'SK13 5CB',
          uprn: '681124619099',
          buildingName: 'Holloway',
          buildingNumberRange: null,
          county: null,
          dependentLocality: null,
          doubleDependentLocality: null,
          flatName: '04',
          pafOrganisationName: null
        }
      },
      customer: {
        name: { title: 'Mr', first: 'Bob', middle: null, last: 'Sledd' }
      }
    },
    detailsConfirmedAt: '2026-04-16T10:08:04.579Z',
    totalHectaresAppliedFor: 195.246,
    guidanceRead: true,
    includedAllEligibleWoodland: true,
    applicationConfirmation: true,
    landParcels: [
      { parcelId: 'SD7560-9193', areaHa: 25.3874 },
      { parcelId: 'SD5848-9205', areaHa: 169.8586 }
    ],
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
