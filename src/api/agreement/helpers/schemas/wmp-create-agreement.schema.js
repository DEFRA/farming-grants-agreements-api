import Joi from 'joi'
// UK postcode regex (allows optional space, both letter cases)
const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i
const externalIdentifier = Joi.alternatives().try(
  Joi.string().trim().min(1),
  Joi.number()
)
const positiveHectares = Joi.number().positive().precision(4)
const moneyPence = Joi.number().integer().min(0)
const unmappedSourceField = Joi.any().optional()
const landParcelSchema = Joi.object({
  parcelId: Joi.string().required(),
  areaHa: positiveHectares.required()
}).unknown(true)
const agreementPaymentItemSchema = Joi.object({
  code: Joi.string().required(),
  description: Joi.string().required(),
  activePaymentTier: unmappedSourceField,
  quantityInActiveTier: unmappedSourceField,
  activeTierRatePence: unmappedSourceField,
  activeTierFlatRatePence: unmappedSourceField,
  quantity: Joi.number().positive().precision(4).optional(),
  agreementTotalPence: moneyPence.required(),
  unit: Joi.string().optional()
}).unknown(true)
const addressSchema = Joi.object({
  line1: Joi.string().required(),
  line2: Joi.string().allow('', null),
  line3: Joi.string().allow('', null),
  line4: Joi.string().allow('', null),
  line5: Joi.string().allow('', null),
  street: Joi.string().allow('', null),
  city: Joi.string().required(),
  postalCode: Joi.string().pattern(POSTCODE_RE).required().messages({
    'string.pattern.base': 'must be a valid UK postcode'
  }),
  uprn: unmappedSourceField,
  buildingName: unmappedSourceField,
  buildingNumberRange: unmappedSourceField,
  county: unmappedSourceField,
  dependentLocality: unmappedSourceField,
  doubleDependentLocality: unmappedSourceField,
  flatName: unmappedSourceField,
  pafOrganisationName: unmappedSourceField
}).unknown(true)
const businessSchema = Joi.object({
  name: Joi.string().required(),
  reference: unmappedSourceField,
  email: unmappedSourceField,
  phone: unmappedSourceField,
  address: addressSchema.required()
}).unknown(true)
const customerSchema = Joi.object({
  name: Joi.object({
    title: Joi.string().allow('', null),
    first: Joi.string().required(),
    middle: Joi.string().allow('', null),
    last: Joi.string().required()
  })
    .required()
    .unknown(true)
}).unknown(true)
const applicantSchema = Joi.object({
  business: businessSchema.required(),
  customer: customerSchema.required()
}).unknown(true)
const metadataSchema = Joi.object({
  // The WMP payload sends an empty `metadata: {}` and puts identifiers at
  // the top level.
  clientRef: Joi.string().optional(),
  submittedAt: unmappedSourceField
}).unknown(true)
const identifiersSchema = Joi.object({
  sbi: externalIdentifier.required(),
  crn: externalIdentifier.required(),
  frn: externalIdentifier.required(),
  defraId: Joi.string().allow('', null)
}).unknown(true)

// WMP cross-field rule: totalAgreementPaymentPence equals the sum of
// payments.agreement[].agreementTotalPence. Both values are mapped into the
// agreement/payment event, so this remains part of the Agreements contract.
function checkPaymentTotal(answers) {
  const items = answers.payments?.agreement
  if (!items?.length || answers.totalAgreementPaymentPence === undefined) {
    return null
  }
  const sum = items.reduce(
    (acc, p) => acc + Number(p.agreementTotalPence || 0),
    0
  )
  if (sum !== answers.totalAgreementPaymentPence) {
    return (
      `totalAgreementPaymentPence (${answers.totalAgreementPaymentPence}) ` +
      `must equal sum of payments.agreement[].agreementTotalPence (${sum})`
    )
  }
  return null
}

function crossFieldChecks(answers, helpers) {
  const errors = [checkPaymentTotal(answers)].filter(Boolean)

  if (errors.length) {
    return helpers.message({ custom: errors.join('; ') })
  }
  return answers
}
const answersSchema = Joi.object({
  woodlandName: Joi.string().trim().min(1).required(),
  businessDetailsUpToDate: unmappedSourceField,
  landRegisteredWithRpa: unmappedSourceField,
  landManagementControl: unmappedSourceField,
  publicBodyTenant: unmappedSourceField,
  landHasGrazingRights: unmappedSourceField,
  appLandHasExistingWmp: unmappedSourceField,
  existingWmps: unmappedSourceField,
  intendToApplyHigherTier: unmappedSourceField,
  hectaresTenOrOverYearsOld: Joi.number().min(0).precision(4).required(),
  hectaresUnderTenYearsOld: Joi.number().min(0).precision(4).required(),
  centreGridReference: unmappedSourceField,
  fcTeamCode: unmappedSourceField,
  applicant: applicantSchema.required(),
  detailsConfirmedAt: unmappedSourceField,
  totalHectaresForSelectedParcels: unmappedSourceField,
  guidanceRead: unmappedSourceField,
  includedAllEligibleWoodland: unmappedSourceField,
  applicationConfirmation: unmappedSourceField,
  // Optional fields preserved if upstream sends them
  agreementName: Joi.string().optional(),
  landParcels: Joi.array().items(landParcelSchema).min(1).required(),
  totalAgreementPaymentPence: moneyPence.required(),
  payments: Joi.object({
    agreement: Joi.array().items(agreementPaymentItemSchema).min(1).required()
  })
    .required()
    .unknown(true)
})
  .unknown(true)
  .custom(crossFieldChecks, 'WMP cross-field validation')
const wmpCreateAgreementSchema = Joi.object({
  // Top-level `clientRef` / `code` / `scheme` are sent on the real Jira
  // payload (`code: 'woodland'` is the canonical WMP signal).
  clientRef: Joi.string().optional(),
  code: Joi.string().required(),
  scheme: Joi.string().optional(),
  metadata: metadataSchema.optional(),
  identifiers: identifiersSchema.required(),
  answers: answersSchema.required()
}).unknown(true)
/**
 * Validate a WMP create-agreement payload.
 * @param {object} payload
 * @returns {{value: object, error: import('joi').ValidationError|undefined}}
 */
export function validateWmpCreateAgreement(payload) {
  return wmpCreateAgreementSchema.validate(payload, {
    abortEarly: false,
    convert: true,
    stripUnknown: false
  })
}
