import crypto from 'node:crypto'
/**
 * Detect a WMP payload via its application code.
 *
 * The upstream contract guarantees `code: 'woodland'` (case-insensitive)
 * on every WMP create-agreement payload — this is the canonical signal.
 * @param {object} payload
 * @returns {boolean}
 */
export function isWmp(payload) {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  return String(payload.code ?? '').toLowerCase() === 'woodland'
}
/**
 * Detect that a *persisted* agreement-version document is WMP.
 *
 * Matches on the persisted `scheme === 'WMP'` or `code === 'woodland'`.
 * @param {object} agreement
 * @returns {boolean}
 */
export function isWmpAgreement(agreement) {
  if (!agreement) {
    return false
  }
  if (
    typeof agreement.scheme === 'string' &&
    agreement.scheme.toUpperCase() === 'WMP'
  ) {
    return true
  }
  return String(agreement.code ?? '').toLowerCase() === 'woodland'
}

const flattenAddress = (a = {}) => ({
  line1: a.line1,
  line2: a.line2 ?? undefined,
  line3: a.line3 ?? undefined,
  line4: a.line4 ?? undefined,
  line5: a.line5 ?? undefined,
  street: a.street ?? undefined,
  city: a.city,
  postalCode: a.postalCode
})

function buildApplicant(answersApplicant) {
  const applicantBusiness = answersApplicant.business
  return {
    business: {
      name: applicantBusiness.name,
      // email/phone are not on the Mongoose Applicant.business sub-schema
      // today; we drop them rather than introduce schema drift. The raw
      // payload remains in the SQS message id for replay.
      address: flattenAddress(applicantBusiness.address)
    },
    customer: {
      name: {
        title: answersApplicant.customer.name.title ?? undefined,
        first: answersApplicant.customer.name.first,
        middle: answersApplicant.customer.name.middle ?? undefined,
        last: answersApplicant.customer.name.last
      }
    }
  }
}

const truncToDateString = (iso) => {
  // ISO date-only (YYYY-MM-DD); the Mongoose schema stores agreement dates as String.
  const d = new Date(iso)
  return d.toISOString().slice(0, 10)
}
const addOneYear = (iso) => {
  const d = new Date(iso)
  d.setUTCFullYear(d.getUTCFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

function buildAgreementLevelItems(agreementItems) {
  const agreementLevelItems = {}
  agreementItems.forEach((item, i) => {
    agreementLevelItems[String(i + 1)] = {
      code: item.code,
      description: item.description,
      version: '1',
      annualPaymentPence: item.agreementTotalPence,
      quantity: item.quantity,
      unit: item.unit,
      activePaymentTier: item.activePaymentTier,
      quantityInActiveTier: item.quantityInActiveTier,
      activeTierRatePence: item.activeTierRatePence,
      activeTierFlatRatePence: item.activeTierFlatRatePence
    }
  })
  return agreementLevelItems
}

function buildPayment({
  agreementItems,
  totalPence,
  agreementStartDate,
  agreementEndDate,
  uuid
}) {
  const lineItems = agreementItems.map((item, i) => ({
    agreementLevelItemId: i + 1,
    paymentPence: item.agreementTotalPence,
    code: item.code,
    description: item.description
  }))
  return {
    agreementStartDate,
    agreementEndDate,
    frequency: 'OneOff',
    agreementTotalPence: totalPence,
    annualTotalPence: totalPence,
    parcelItems: {},
    agreementLevelItems: buildAgreementLevelItems(agreementItems),
    payments: [
      {
        totalPaymentPence: totalPence,
        paymentDate: null,
        correlationId: uuid(),
        lineItems
      }
    ]
  }
}

function buildParcelDocs(landParcels, agreementItems) {
  return landParcels.map((lp) => ({
    parcelId: lp.parcelId,
    area: { unit: 'ha', quantity: lp.areaHa },
    actions: agreementItems.map((item) => ({
      code: item.code,
      version: '1',
      durationYears: 1,
      appliedFor: { unit: 'ha', quantity: lp.areaHa }
    }))
  }))
}

function buildActionApplications(landParcels, agreementItems) {
  const out = []
  for (const lp of landParcels) {
    for (const item of agreementItems) {
      out.push({
        code: item.code,
        sheetId: lp.sheetId ?? lp.parcelId,
        parcelId: lp.parcelId,
        appliedFor: { unit: 'ha', quantity: lp.areaHa }
      })
    }
  }
  return out
}

/**
 * Map a validated WMP create-agreement payload to a `versions` document.
 *
 * When `answers.payments.agreement[]` and `answers.totalAgreementPaymentPence`
 * are present, a full payment subdoc is built (frequency `OneOff`, paid on
 * signature). Otherwise `payment` is `null`.
 *
 * `actionApplications` and `application.parcel[]` are populated from
 * `answers.landParcels × answers.payments.agreement[]`. They stay empty
 * if either is absent.
 * @param {object} payload - validated WMP create-agreement payload
 * @param {object} [opts]
 * @param {string} [opts.notificationMessageId] - SQS message id (required for insert)
 * @param {string} [opts.correlationId] - version-level tracing id (defaults to a fresh uuid)
 * @param {() => string} [opts.uuid] - injectable uuid generator (for tests)
 * @returns {object} versions document
 */
export function mapWmpPayloadToVersion(payload, opts = {}) {
  const {
    notificationMessageId,
    correlationId,
    uuid = crypto.randomUUID
  } = opts
  const meta = payload.metadata ?? {}
  const answers = payload.answers
  const ids = {
    sbi: payload.identifiers?.sbi ?? meta.sbi,
    crn: payload.identifiers?.crn ?? meta.crn,
    frn: payload.identifiers?.frn ?? meta.frn,
    defraId: payload.identifiers?.defraId
  }

  // Date basis: prefer metadata.submittedAt, fall back to answers.detailsConfirmedAt, else now.
  const submittedAt =
    meta.submittedAt ?? answers.detailsConfirmedAt ?? new Date().toISOString()
  const agreementStartDate = truncToDateString(submittedAt)
  const agreementEndDate = addOneYear(submittedAt)

  const agreementItems = answers.payments?.agreement ?? []
  const totalPence = answers.totalAgreementPaymentPence
  const landParcels = answers.landParcels ?? []
  const hasPaymentInfo =
    agreementItems.length > 0 && Number.isFinite(totalPence)

  return {
    notificationMessageId,
    agreementName: answers.agreementName ?? 'Woodland Management Plan',
    correlationId: correlationId ?? uuid(),
    clientRef: payload.clientRef ?? meta.clientRef,
    code: payload.code ?? 'wmp',
    scheme: payload.scheme ?? 'WMP',
    identifiers: ids,
    status: 'offered',
    actionApplications: buildActionApplications(landParcels, agreementItems),
    payment: hasPaymentInfo
      ? buildPayment({
          agreementItems,
          totalPence,
          agreementStartDate,
          agreementEndDate,
          uuid
        })
      : null,
    applicant: buildApplicant(answers.applicant),
    application: { parcel: buildParcelDocs(landParcels, agreementItems) }
  }
}
