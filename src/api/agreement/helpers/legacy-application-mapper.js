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

function summariseParcels(parcels = [], defaultDurationYears) {
  const parcelItems = {}
  const agreementLevelItems = {}
  let parcelIndex = 1
  let agreementLevelIndex = 1
  let computedAgreementTotal = 0
  let computedAnnualTotal = 0
  let maxDurationYears = defaultDurationYears

  parcels.forEach((parcel) => {
    const actions = parcel.actions || []
    actions.forEach((action) => {
      const eligible = action.appliedFor || action.eligible || {}
      const ratePerUnit = toNumber(action.paymentRates?.ratePerUnitPence, null)
      const annualPayment =
        action.annualPaymentPence ??
        (ratePerUnit !== null && eligible?.quantity !== undefined
          ? Math.round(ratePerUnit * Number(eligible.quantity))
          : null)

      parcelItems[parcelIndex] = {
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
        toNumber(action.durationYears, defaultDurationYears) ||
        defaultDurationYears
      maxDurationYears = Math.max(maxDurationYears, durationYears)

      if (annualPayment !== null && annualPayment !== undefined) {
        computedAgreementTotal += annualPayment * durationYears
        computedAnnualTotal += annualPayment
      }

      const agreementLevelAmount =
        action.paymentRates?.agreementLevelAmountPence
      if (agreementLevelAmount) {
        agreementLevelItems[agreementLevelIndex] = {
          code: action.code,
          description: action.description,
          version: 1,
          annualPaymentPence: agreementLevelAmount
        }
        agreementLevelIndex += 1
      }

      parcelIndex += 1
    })
  })

  return {
    parcelItems,
    agreementLevelItems,
    computedAgreementTotal,
    computedAnnualTotal,
    maxDurationYears
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
