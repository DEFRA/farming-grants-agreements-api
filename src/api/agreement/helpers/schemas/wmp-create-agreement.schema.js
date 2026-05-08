import Joi from 'joi'
// UK postcode regex (allows optional space, both letter cases)
const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i
// Identifier digit lengths (DEFRA business reference standards)
const SBI_DIGITS = 9
const CRN_DIGITS = 10
const FRN_DIGITS = 10
const numericString = (digits) =>
  Joi.string()
    .pattern(new RegExp(String.raw`^\d{${digits}}$`))
    .messages({
      'string.pattern.base': `must be a ${digits}-digit numeric string`
    })
const positiveHectares = Joi.number().positive().precision(4)
const moneyPence = Joi.number().integer().min(0)
const HECTARES_TOLERANCE = 0.01
const landParcelSchema = Joi.object({
  parcelId: Joi.string().required(),
  areaHa: positiveHectares.required()
}).unknown(true)
const agreementPaymentItemSchema = Joi.object({
  code: Joi.string().required(),
  description: Joi.string().required(),
  activePaymentTier: Joi.number().integer().min(1).optional(),
  quantityInActiveTier: Joi.number().min(0).optional(),
  activeTierRatePence: moneyPence.optional(),
  activeTierFlatRatePence: moneyPence.optional(),
  quantity: Joi.number().positive().precision(4).optional(),
  agreementTotalPence: moneyPence.optional(),
  unit: Joi.string().optional()
}).unknown(true)
// `email` and `phone` arrive as objects on the real payload, but a string
// form is also tolerated for forwards-compat with §3.1 of the plan.
const emailField = Joi.alternatives().try(
  Joi.string()
    .email({ tlds: { allow: false } })
    .allow(''),
  Joi.object({
    address: Joi.string()
      .email({ tlds: { allow: false } })
      .allow('')
      .required()
  }).unknown(true)
)
const phoneField = Joi.alternatives().try(
  Joi.string().allow(''),
  Joi.object({
    landline: Joi.string().allow(''),
    mobile: Joi.string().allow('')
  })
    .or('landline', 'mobile')
    .unknown(true)
)
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
  // Optional PAF/UPRN fields carried verbatim
  uprn: Joi.string().allow('', null),
  buildingName: Joi.string().allow('', null),
  buildingNumberRange: Joi.string().allow('', null),
  county: Joi.string().allow('', null),
  dependentLocality: Joi.string().allow('', null),
  doubleDependentLocality: Joi.string().allow('', null),
  flatName: Joi.string().allow('', null),
  pafOrganisationName: Joi.string().allow('', null)
}).unknown(true)
const businessSchema = Joi.object({
  name: Joi.string().required(),
  reference: Joi.string().allow('', null),
  email: emailField.optional(),
  phone: phoneField.optional(),
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
  // the top level — every field below is therefore optional.
  clientRef: Joi.string().optional(),
  sbi: numericString(SBI_DIGITS).optional(),
  crn: numericString(CRN_DIGITS).optional(),
  frn: numericString(FRN_DIGITS).optional(),
  submittedAt: Joi.date().iso().optional()
}).unknown(true)
const identifiersSchema = Joi.object({
  sbi: numericString(SBI_DIGITS).required(),
  crn: numericString(CRN_DIGITS).required(),
  frn: numericString(FRN_DIGITS).required(),
  defraId: Joi.string().allow('', null)
}).unknown(true)

// WMP cross-field rules:
//  - existingWmps non-empty when appLandHasExistingWmp === true
//  - totalAgreementPaymentPence (if present) equals sum of payments.agreement[].agreementTotalPence
//  - totalHectaresAppliedFor (if landParcels present) equals sum of areaHa within tolerance
function checkExistingWmps(answers) {
  if (answers.appLandHasExistingWmp !== true) {
    return null
  }
  const ew = answers.existingWmps
  const empty =
    ew == null ||
    (typeof ew === 'string' && ew.trim() === '') ||
    (Array.isArray(ew) && ew.length === 0)
  if (empty) {
    return 'existingWmps is required and must be non-empty when appLandHasExistingWmp is true'
  }
  return null
}

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

function checkHectaresTotal(answers) {
  if (!answers.landParcels?.length) {
    return null
  }
  const sumHa = answers.landParcels.reduce(
    (acc, p) => acc + Number(p.areaHa || 0),
    0
  )
  if (Math.abs(sumHa - answers.totalHectaresAppliedFor) > HECTARES_TOLERANCE) {
    return (
      `totalHectaresAppliedFor (${answers.totalHectaresAppliedFor}) must equal ` +
      `sum of landParcels[].areaHa (${sumHa.toFixed(4)}) within ±${HECTARES_TOLERANCE}`
    )
  }
  return null
}

function crossFieldChecks(answers, helpers) {
  const errors = [
    checkExistingWmps(answers),
    checkPaymentTotal(answers),
    checkHectaresTotal(answers)
  ].filter(Boolean)

  if (errors.length) {
    return helpers.message({ custom: errors.join('; ') })
  }
  return answers
}
const answersSchema = Joi.object({
  businessDetailsUpToDate: Joi.boolean().strict().required(),
  landRegisteredWithRpa: Joi.boolean().strict().required(),
  landManagementControl: Joi.boolean().strict().required(),
  publicBodyTenant: Joi.boolean().strict().required(),
  landHasGrazingRights: Joi.boolean().strict().required(),
  appLandHasExistingWmp: Joi.boolean().strict().required(),
  // The real payload sends `existingWmps` as a string; keep array as a
  // forwards-compat alternative.
  existingWmps: Joi.alternatives()
    .try(Joi.string().allow(''), Joi.array().items(Joi.any()))
    .optional(),
  intendToApplyHigherTier: Joi.boolean().strict().required(),
  hectaresTenOrOverYearsOld: Joi.number().min(0).precision(4).required(),
  hectaresUnderTenYearsOld: Joi.number().min(0).precision(4).required(),
  centreGridReference: Joi.string().required(),
  fcTeamCode: Joi.string().required(),
  applicant: applicantSchema.required(),
  detailsConfirmedAt: Joi.date().iso().required(),
  totalHectaresAppliedFor: positiveHectares.required(),
  guidanceRead: Joi.boolean().strict().valid(true).required().messages({
    'any.only': 'guidanceRead must be true'
  }),
  includedAllEligibleWoodland: Joi.boolean().strict().required(),
  applicationConfirmation: Joi.boolean()
    .strict()
    .valid(true)
    .required()
    .messages({ 'any.only': 'applicationConfirmation must be true' }),
  // Optional fields preserved if upstream sends them
  agreementName: Joi.string().optional(),
  landParcels: Joi.array().items(landParcelSchema).min(1).optional(),
  totalAgreementPaymentPence: moneyPence.optional(),
  payments: Joi.object({
    agreement: Joi.array().items(agreementPaymentItemSchema).min(1).required()
  })
    .optional()
    .unknown(true)
})
  .unknown(true)
  .custom(crossFieldChecks, 'WMP cross-field validation')
const wmpCreateAgreementSchema = Joi.object({
  // Top-level `clientRef` / `code` / `scheme` are sent on the real Jira
  // payload (`code: 'woodland'` is the canonical WMP signal).
  clientRef: Joi.string().optional(),
  code: Joi.string().optional(),
  scheme: Joi.string().optional(),
  metadata: metadataSchema.optional(),
  identifiers: identifiersSchema.optional(),
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
