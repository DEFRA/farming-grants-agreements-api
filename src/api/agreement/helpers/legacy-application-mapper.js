const DEFAULT_PAYMENT_FREQUENCY = 'Quarterly'

export const buildLegacyPaymentFromApplication = (agreementData) => {
  const { application } = agreementData || {}
  if (!application) {
    return {}
  }

  const {
    applicant: applicationApplicant,
    totalAnnualPaymentPence,
    parcels = [],
    agreementStartDate,
    agreementEndDate,
    paymentFrequency,
    durationYears: applicationDurationYears
  } = application

  const defaultDurationYears = toNumber(applicationDurationYears, 1) || 1

  const {
    parcelItems,
    agreementLevelItems,
    computedAgreementTotal,
    computedAnnualTotal,
    maxDurationYears
  } = summariseParcels(parcels, defaultDurationYears)

  const { annualTotalPence, agreementTotalPence } = calculateTotals({
    totalAnnualPaymentPence,
    parcelItems,
    agreementLevelItems,
    computedAgreementTotal,
    computedAnnualTotal,
    maxDurationYears,
    defaultDurationYears
  })

  const { startDate, endDate } = resolveAgreementDates({
    agreementData,
    agreementStartDate,
    agreementEndDate,
    maxDurationYears,
    defaultDurationYears
  })

  const payments = buildPaymentsWithPlaceholders({
    startDate,
    parcelItems,
    agreementLevelItems,
    annualTotalPence
  })

  return {
    payment: {
      agreementStartDate: startDate,
      agreementEndDate: endDate,
      frequency: paymentFrequency || DEFAULT_PAYMENT_FREQUENCY, // TODO: remove legacy fall-back once schedule is deprecated
      agreementTotalPence,
      annualTotalPence,
      parcelItems,
      agreementLevelItems,
      payments,
      inclusion: {
        // Expose the inputs we use to derive agreement totals so legacy UI/tests
        // can verify calculations while the schedule is being phased out.
        // TODO: remove this block once schedule handling is fully deprecated.
        defaultDurationYears,
        maxDurationYears,
        computedAgreementTotal,
        computedAnnualTotal
      }
    },
    applicant: applicationApplicant,
    actionApplications: buildLegacyActionApplications(parcels)
  }
}

const NUMBER_OF_QUARTERS = 4
const MONTHS_IN_QUARTER = 3

function buildPaymentsWithPlaceholders({
  startDate,
  parcelItems,
  agreementLevelItems,
  annualTotalPence
}) {
  const parcelEntries = Object.entries(parcelItems || {})
  const agreementLevelEntries = Object.entries(agreementLevelItems || {})

  const quarterLineItems = [
    ...parcelEntries.map(([id, item]) => ({
      parcelItemId: Number(id),
      paymentPence: Math.round(
        toNumber(item.annualPaymentPence, 0) / NUMBER_OF_QUARTERS
      ) // TODO: remove legacy fall-back once schedule is deprecated
    })),
    ...agreementLevelEntries.map(([id, item]) => ({
      agreementLevelItemId: Number(id),
      paymentPence: Math.round(
        toNumber(item.annualPaymentPence, 0) / NUMBER_OF_QUARTERS
      ) // TODO: remove legacy fall-back once schedule is deprecated
    }))
  ]

  const totalQuarterly =
    quarterLineItems.reduce(
      (sum, lineItem) => sum + toNumber(lineItem.paymentPence),
      0
    ) || Math.round(toNumber(annualTotalPence, 0) / NUMBER_OF_QUARTERS) // TODO: remove legacy fall-back once schedule is deprecated

  const firstPaymentDate = addMonths(startDate, MONTHS_IN_QUARTER) // TODO: remove legacy fall-back once schedule is deprecated
  const subsequentPaymentDate = addMonths(startDate, MONTHS_IN_QUARTER * 2) // TODO: remove legacy fall-back once schedule is deprecated

  return [
    {
      totalPaymentPence: totalQuarterly,
      paymentDate: firstPaymentDate,
      lineItems: quarterLineItems
    },
    {
      totalPaymentPence: totalQuarterly,
      paymentDate: subsequentPaymentDate,
      lineItems: quarterLineItems
    }
  ]
}

function buildLegacyActionApplications(parcels = []) {
  return parcels.flatMap((parcel) =>
    (parcel.actions || []).map((action) => ({
      parcelId: parcel.parcelId,
      sheetId: parcel.sheetId,
      code: action.code,
      appliedFor: action.appliedFor || action.eligible || {}
    }))
  )
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback
  }
  return Number(value)
}

function addMonths(isoDate, monthsToAdd = 0) {
  const date = isoDate ? new Date(isoDate) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString()
  }

  const cloned = new Date(date)
  cloned.setUTCMonth(cloned.getUTCMonth() + monthsToAdd)
  return cloned.toISOString()
}

function addYears(isoDate, yearsToAdd = 0) {
  const date = isoDate ? new Date(isoDate) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString()
  }

  const cloned = new Date(date)
  cloned.setUTCFullYear(cloned.getUTCFullYear() + yearsToAdd)
  return cloned.toISOString()
}

function summariseParcels(parcels, defaultDurationYears) {
  const state = {
    parcelItems: {},
    agreementLevelItems: {},
    parcelIndex: 1,
    agreementLevelIndex: 1,
    computedAgreementTotal: 0,
    computedAnnualTotal: 0,
    maxDurationYears: defaultDurationYears
  }

  ;(parcels ?? []).forEach((parcel) => {
    const actions = parcel.actions ?? []
    actions.forEach((action) => {
      updateParcelStateForAction(state, parcel, action, defaultDurationYears)
    })
  })

  return {
    parcelItems: state.parcelItems,
    agreementLevelItems: state.agreementLevelItems,
    computedAgreementTotal: state.computedAgreementTotal,
    computedAnnualTotal: state.computedAnnualTotal,
    maxDurationYears: state.maxDurationYears
  }
}

function calculateTotals({
  totalAnnualPaymentPence,
  parcelItems,
  agreementLevelItems,
  computedAgreementTotal,
  computedAnnualTotal,
  maxDurationYears,
  defaultDurationYears
}) {
  const annualTotalPence =
    toNumber(totalAnnualPaymentPence, 0) ||
    Object.values(parcelItems).reduce(
      (sum, item) => sum + toNumber(item.annualPaymentPence, 0),
      0
    ) +
      Object.values(agreementLevelItems).reduce(
        (sum, item) => sum + toNumber(item.annualPaymentPence, 0),
        0
      )

  const durationYears = maxDurationYears || defaultDurationYears || 1

  const agreementTotalPence =
    computedAgreementTotal ||
    annualTotalPence * durationYears || // TODO: remove legacy fall-back once schedule is deprecated
    computedAnnualTotal

  return { annualTotalPence, agreementTotalPence }
}

function resolveAgreementDates({
  agreementData,
  agreementStartDate,
  agreementEndDate,
  maxDurationYears,
  defaultDurationYears
}) {
  const startDate =
    agreementStartDate ||
    agreementData.agreementStartDate ||
    agreementData.answers?.payment?.agreementStartDate ||
    new Date().toISOString() // TODO: remove legacy fall-back once schedule is deprecated

  const endDate =
    agreementEndDate ||
    agreementData.agreementEndDate ||
    agreementData.answers?.payment?.agreementEndDate ||
    addYears(startDate, maxDurationYears || defaultDurationYears || 1) // TODO: remove legacy fall-back once schedule is deprecated

  return { startDate, endDate }
}

export const __private__ = {
  addMonths,
  addYears
}

function updateParcelStateForAction(
  state,
  parcel,
  action,
  defaultDurationYears
) {
  const eligible = action.appliedFor || action.eligible || {}
  const ratePerUnit = toNumber(action.paymentRates?.ratePerUnitPence, NaN)
  const annualPayment =
    action.annualPaymentPence ??
    (Number.isFinite(ratePerUnit) && eligible?.quantity !== undefined
      ? Math.round(ratePerUnit * Number(eligible.quantity))
      : null)

  state.parcelItems[state.parcelIndex] = {
    code: action.code,
    description: action.description,
    version: 1,
    unit: eligible.unit || null,
    quantity:
      eligible.quantity !== undefined
        ? Number(eligible.quantity)
        : eligible.quantity,
    rateInPence: ratePerUnit,
    annualPaymentPence: annualPayment,
    sheetId: parcel.sheetId,
    parcelId: parcel.parcelId
  }

  const durationYears =
    toNumber(action.durationYears, defaultDurationYears) || defaultDurationYears
  state.maxDurationYears = Math.max(state.maxDurationYears, durationYears)

  if (annualPayment !== null && annualPayment !== undefined) {
    state.computedAgreementTotal += annualPayment * durationYears
    state.computedAnnualTotal += annualPayment
  }

  const agreementLevelAmount = action.paymentRates?.agreementLevelAmountPence
  if (agreementLevelAmount) {
    state.agreementLevelItems[state.agreementLevelIndex] = {
      code: action.code,
      description: action.description,
      version: 1,
      annualPaymentPence: agreementLevelAmount
    }
    state.agreementLevelIndex += 1
  }

  state.parcelIndex += 1
}
