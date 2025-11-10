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

  const parcelItems = {}
  const agreementLevelItems = {}
  let parcelIndex = 1
  let agreementLevelIndex = 1
  let computedAgreementTotal = 0
  let maxDurationYears = toNumber(applicationDurationYears, 1) || 1

  parcels.forEach((parcel) => {
    const { actions = [] } = parcel
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
          eligible.quantity !== undefined ? Number(eligible.quantity) : eligible.quantity,
        rateInPence: ratePerUnit,
        annualPaymentPence: annualPayment,
        sheetId: parcel.sheetId,
        parcelId: parcel.parcelId
      }

      const durationYears = toNumber(action.durationYears, 1) || 1
      maxDurationYears = Math.max(maxDurationYears, durationYears)

      if (annualPayment !== null && annualPayment !== undefined) {
        computedAgreementTotal += annualPayment * durationYears
      }

      const agreementLevelAmount = action.paymentRates?.agreementLevelAmountPence
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

  const startDate =
    agreementStartDate ||
    agreementData.agreementStartDate ||
    agreementData.answers?.payment?.agreementStartDate ||
    new Date().toISOString() // Placeholder: fall back to "now" when start date missing

  const agreementTotalPence =
    computedAgreementTotal || annualTotalPence * (maxDurationYears || 1) // Placeholder: estimate agreement total from duration

  const endDate =
    agreementEndDate ||
    agreementData.agreementEndDate ||
    agreementData.answers?.payment?.agreementEndDate ||
    addYears(startDate, maxDurationYears || 1) // Placeholder: derive end date by adding duration

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
      frequency: paymentFrequency || DEFAULT_PAYMENT_FREQUENCY, // Placeholder: assume quarterly cadence when missing
      agreementTotalPence,
      annualTotalPence,
      parcelItems,
      agreementLevelItems,
      payments
    },
    applicant: applicationApplicant,
    actionApplications: buildLegacyActionApplications(parcels)
  }
}

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
      paymentPence: Math.round(toNumber(item.annualPaymentPence, 0) / 4) // Placeholder: evenly split annual parcel payments across four quarters
    })),
    ...agreementLevelEntries.map(([id, item]) => ({
      agreementLevelItemId: Number(id),
      paymentPence: Math.round(toNumber(item.annualPaymentPence, 0) / 4) // Placeholder: evenly split agreement-level payments across four quarters
    }))
  ]

  const totalQuarterly =
    quarterLineItems.reduce((sum, lineItem) => sum + toNumber(lineItem.paymentPence), 0) ||
    Math.round(toNumber(annualTotalPence, 0) / 4) // Placeholder: use annual total if line-item sums are unavailable

  const firstPaymentDate = addMonths(startDate, 3) // Placeholder: assume first payment 3 months after start
  const subsequentPaymentDate = addMonths(startDate, 6) // Placeholder: assume subsequent payment 6 months after start

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

function addMonths(isoDate, monthsToAdd) {
  const date = isoDate ? new Date(isoDate) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString()
  }

  const cloned = new Date(date)
  cloned.setUTCMonth(cloned.getUTCMonth() + monthsToAdd)
  return cloned.toISOString()
}

function addYears(isoDate, yearsToAdd) {
  const date = isoDate ? new Date(isoDate) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString()
  }

  const cloned = new Date(date)
  cloned.setUTCFullYear(cloned.getUTCFullYear() + yearsToAdd)
  return cloned.toISOString()
}

