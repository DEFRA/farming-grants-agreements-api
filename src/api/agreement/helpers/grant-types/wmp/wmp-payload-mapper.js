import crypto from 'node:crypto'

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

function buildAgreementLevelItems(agreementItems) {
  const agreementLevelItems = {}
  agreementItems.forEach((item, i) => {
    agreementLevelItems[String(i + 1)] = {
      code: item.code,
      description: item.description,
      version: '1',
      annualPaymentPence: item.agreementTotalPence
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
      appliedFor: { unit: item.unit ?? 'ha', quantity: item.quantity }
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

function buildIdentifiers(payload, meta) {
  const src = payload.identifiers ?? {}
  return {
    sbi: src.sbi ?? meta.sbi,
    crn: src.crn ?? meta.crn,
    frn: src.frn ?? meta.frn,
    defraId: src.defraId
  }
}

function buildPaymentOrNull(ctx) {
  const { agreementItems, totalPence } = ctx
  if (agreementItems.length === 0 || !Number.isFinite(totalPence)) {
    return null
  }
  return buildPayment(ctx)
}

function buildVersionHeader(payload, meta, answers, correlationId, uuid) {
  return {
    agreementName: answers.agreementName ?? 'Woodland Management Plan',
    correlationId: correlationId ?? uuid(),
    clientRef: payload.clientRef ?? meta.clientRef,
    code: payload.code,
    scheme: payload.scheme ?? 'WMP'
  }
}

function buildSchemeData(answers) {
  return {
    oldWoodlandAreaHa: answers.hectaresTenOrOverYearsOld,
    newWoodlandAreaHa: answers.hectaresUnderTenYearsOld
  }
}

/**
 * Map a validated WMP create-agreement payload to a `versions` document.
 *
 * A full payment subdoc is built from `answers.payments.agreement[]` and
 * `answers.totalAgreementPaymentPence` (frequency `OneOff`, paid on
 * signature).
 *
 * `actionApplications` and `application.parcel[]` are populated from
 * `answers.landParcels × answers.payments.agreement[]`.
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
  const agreementItems = answers.payments?.agreement ?? []
  const landParcels = answers.landParcels ?? []

  return {
    notificationMessageId,
    ...buildVersionHeader(payload, meta, answers, correlationId, uuid),
    identifiers: buildIdentifiers(payload, meta),
    status: 'offered',
    schemeData: buildSchemeData(answers),
    actionApplications: buildActionApplications(landParcels, agreementItems),
    payment: buildPaymentOrNull({
      agreementItems,
      totalPence: answers.totalAgreementPaymentPence,
      agreementStartDate: null,
      agreementEndDate: null,
      uuid
    }),
    applicant: buildApplicant(answers.applicant),
    application: { parcel: buildParcelDocs(landParcels, agreementItems) }
  }
}
