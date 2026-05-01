import Joi from 'joi'
// UK postcode regex (allows optional space, both letter cases)
const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i
const HECTARES_TOLERANCE = 0.01
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
const moneyPence = Joi.number().integer().min(0)
const positiveHectares = Joi.number().positive().precision(4)
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
  clientRef: Joi.string().required(),
  sbi: numericString(SBI_DIGITS).required(),
  crn: numericString(CRN_DIGITS).required(),
  frn: numericString(FRN_DIGITS).required(),
  submittedAt: Joi.date().iso().required()
}).unknown(true)
const identifiersSchema = Joi.object({
  sbi: numericString(SBI_DIGITS).required(),
  crn: numericString(CRN_DIGITS).required(),
  frn: numericString(FRN_DIGITS).required(),
  defraId: Joi.string().allow('', null)
}).unknown(true)
const landParcelSchema = Joi.object({
  parcelId: Joi.string().required(),
  areaHa: positiveHectares.required()
}).unknown(true)
const agreementPaymentItemSchema = Joi.object({
  code: Joi.string().required(),
  description: Joi.string().required(),
  activePaymentTier: Joi.number().integer().min(1).required(),
  quantityInActiveTier: Joi.number().min(0).required(),
  activeTierRatePence: moneyPence.required(),
  activeTierFlatRatePence: moneyPence.required(),
  quantity: Joi.number().positive().precision(4).required(),
  agreementTotalPence: moneyPence.required(),
  unit: Joi.string().required()
}).unknown(true)
function checkPaymentTotal(answers) {
  const sumPayments = (answers.payments?.agreement || []).reduce(
    (acc, p) => acc + Number(p.agreementTotalPence || 0),
    0
  )
  if (sumPayments !== answers.totalAgreementPaymentPence) {
    return (
      `totalAgreementPaymentPence (${answers.totalAgreementPaymentPence}) ` +
      `must equal sum of payments.agreement[].agreementTotalPence (${sumPayments})`
    )
  }
  return null
}

function checkHectaresTotal(answers) {
  const sumHa = (answers.landParcels || []).reduce(
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

function crossFieldChecks(answers, helpers) {
  const errors = [
    checkPaymentTotal(answers),
    checkHectaresTotal(answers),
    checkExistingWmps(answers)
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
  totalHectaresAppliedFor: Joi.number().positive().precision(4).required(),
  guidanceRead: Joi.boolean().strict().valid(true).required().messages({
    'any.only': 'guidanceRead must be true'
  }),
  includedAllEligibleWoodland: Joi.boolean().strict().required(),
  applicationConfirmation: Joi.boolean()
    .strict()
    .valid(true)
    .required()
    .messages({ 'any.only': 'applicationConfirmation must be true' }),
  landParcels: Joi.array().items(landParcelSchema).min(1).required(),
  totalAgreementPaymentPence: moneyPence.required(),
  payments: Joi.object({
    agreement: Joi.array().items(agreementPaymentItemSchema).min(1).required()
  })
    .required()
    .unknown(true),
  // Optional fields preserved if upstream sends them
  agreementName: Joi.string().optional()
})
  .unknown(true)
  .custom(crossFieldChecks, 'WMP cross-field validation')
const wmpCreateAgreementSchema = Joi.object({
  // Top-level `code` / `scheme` are absent on the real Jira payload but
  // tolerated if upstream adds them later.
  clientRef: Joi.string().optional(),
  code: Joi.string().optional(),
  scheme: Joi.string().optional(),
  metadata: metadataSchema.required(),
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
