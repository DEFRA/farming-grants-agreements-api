import crypto from 'node:crypto'
/**
 * Detect a WMP payload via the pragmatic interim heuristic
 * (plan.md §12.1).
 *
 * Primary signal: `metadata.clientRef` (or top-level `clientRef`) starts
 * with `wmp` (case-insensitive). Corroborated by the presence of a
 * WMP-only `answers.*` key. Both required to avoid false-positives.
 * @param {object} payload
 * @returns {boolean}
 */
export function isWmp(payload) {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const clientRef = String(
    payload?.metadata?.clientRef ?? payload?.clientRef ?? ''
  )
  if (!clientRef.toLowerCase().startsWith('wmp')) {
    return false
  }
  const answers = payload.answers || {}
  const wmpOnlyKeys = [
    'appLandHasExistingWmp',
    'fcTeamCode',
    'includedAllEligibleWoodland',
    'centreGridReference'
  ]
  return wmpOnlyKeys.some((key) => answers[key] !== undefined)
}
/**
 * Detect that a *persisted* agreement-version document is WMP. Used by
 * the GET and accept paths to short-circuit the Land Grants lookup
 * (plan.md §4.3 / §12.3).
 *
 * Falls back to the same `clientRef` prefix heuristic when `scheme` is
 * absent (the MVP doesn't add a strict `scheme` enum).
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
  const clientRef = String(agreement.clientRef ?? '')
  return clientRef.toLowerCase().startsWith('wmp')
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
  const actionApplications = []
  for (const lp of landParcels) {
    for (const item of agreementItems) {
      actionApplications.push({
        code: item.code,
        sheetId: lp.sheetId ?? lp.parcelId,
        parcelId: lp.parcelId,
        appliedFor: { unit: 'ha', quantity: lp.areaHa }
      })
    }
  }
  return actionApplications
}

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

export function mapWmpPayloadToVersion(payload, opts = {}) {
  const {
    notificationMessageId,
    correlationId,
    uuid = crypto.randomUUID
  } = opts
  const meta = payload.metadata
  const answers = payload.answers
  const ids = payload.identifiers ?? {
    sbi: meta.sbi,
    crn: meta.crn,
    frn: meta.frn
  }
  const agreementStartDate = truncToDateString(meta.submittedAt)
  const agreementEndDate = addOneYear(meta.submittedAt)
  const agreementItems = answers.payments.agreement
  const totalPence = answers.totalAgreementPaymentPence

  return {
    notificationMessageId,
    agreementName: answers.agreementName ?? 'Woodland Management Plan',
    correlationId: correlationId ?? uuid(),
    clientRef: payload.clientRef ?? meta.clientRef,
    code: payload.code ?? 'wmp',
    scheme: payload.scheme ?? 'WMP',
    identifiers: {
      sbi: ids.sbi,
      crn: ids.crn,
      frn: ids.frn,
      defraId: ids.defraId
    },
    status: 'offered',
    actionApplications: buildActionApplications(
      answers.landParcels,
      agreementItems
    ),
    payment: buildPayment({
      agreementItems,
      totalPence,
      agreementStartDate,
      agreementEndDate,
      uuid
    }),
    applicant: buildApplicant(answers.applicant),
    application: {
      parcel: buildParcelDocs(answers.landParcels, agreementItems)
    }
  }
}
