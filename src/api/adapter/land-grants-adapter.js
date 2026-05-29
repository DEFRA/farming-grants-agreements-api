import { config } from '#~/config/index.js'
import { fetchWithTimeout } from '#~/api/common/helpers/fetch.js'

const coerceNumber = (raw) => {
  if (raw == null) {
    return null
  }

  // Convert bigint safely
  if (typeof raw === 'bigint') {
    return Number(raw)
  }

  // Fast path for numbers
  if (typeof raw === 'number') {
    return raw
  }

  // Try parsing anything else as a float
  const parsed = Number.parseFloat(raw)
  return Number.isNaN(parsed) ? null : parsed
}

const parseQuantity = (raw) => {
  const value = coerceNumber(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

const buildAuthHeader = () => {
  const token = config.get('landGrants.token')
  return { Authorization: `Bearer ${token}` }
}

const postPaymentCalculation = async (body, options = {}) => {
  const {
    calculationUri = config.get('landGrants.calculationUri'),
    headers: extraHeaders = {}
  } = options

  const landGrantsBaseUrl = config.get('landGrants.uri')
  const url = new URL(calculationUri, landGrantsBaseUrl)

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Land Grants Payment calculate request failed: ${res.status} ${res.statusText} ${text}`
    )
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return res.json()
  }

  return res.text()
}

const convertParcelsToLandGrantsPayload = (parcels = []) => {
  if (!Array.isArray(parcels)) {
    throw new TypeError('parcels must be an array')
  }

  const grouped = new Map()

  for (const parcel of parcels) {
    if (!parcel?.sheetId || !parcel?.parcelId) {
      continue
    }

    if (!Array.isArray(parcel.actions)) {
      throw new TypeError('parcel actions must be an array')
    }

    const key = `${parcel.sheetId}|${parcel.parcelId}`
    const existing = grouped.get(key) ?? {
      sheetId: parcel.sheetId,
      parcelId: parcel.parcelId,
      actions: []
    }

    for (const action of parcel.actions) {
      const quantity = parseQuantity(action.appliedFor?.quantity)
      if (quantity == null) {
        grouped.set(key, existing)
        continue
      }

      existing.actions.push({
        code: action.code,
        quantity
      })
    }
    grouped.set(key, existing)
  }

  return { parcel: Array.from(grouped.values()) }
}

const calculatePaymentsBasedOnParcelsWithActions = async (
  parcels,
  logger,
  options = {}
) => {
  const payload = convertParcelsToLandGrantsPayload(parcels)

  if (logger) {
    logger.info(
      `Sending Land Grants payment calculation request for ${payload?.parcel?.length || 0} parcels`
    )
  }

  const response = await postPaymentCalculation(payload, {
    calculationUri: options.calculationUri,
    headers: buildAuthHeader()
  })

  if (logger) {
    logger.info('Successfully called Land Grants payment calculation')
  }

  const payment = response?.payment
  if (!payment) {
    throw new Error('Land Grants response missing "payment" field')
  }
  if (!payment.agreementStartDate || !payment.agreementEndDate) {
    throw new Error(
      'FPTT payment calculation must include agreementStartDate and agreementEndDate'
    )
  }

  const {
    agreementStartDate,
    agreementEndDate,
    frequency,
    agreementTotalPence,
    annualTotalPence,
    parcelItems,
    agreementLevelItems,
    payments
  } = payment

  return {
    agreementStartDate,
    agreementEndDate,
    frequency,
    agreementTotalPence,
    annualTotalPence,
    parcelItems,
    agreementLevelItems,
    payments
  }
}

const calculateWmpPaymentDates = async (requestData, logger, options = {}) => {
  const payload = {
    parcelIds: requestData?.parcelIds ?? [],
    oldWoodlandAreaHa: requestData?.oldWoodlandAreaHa,
    newWoodlandAreaHa: requestData?.newWoodlandAreaHa
  }

  if (logger) {
    logger.info('Sending Land Grants WMP payment calculation request')
  }

  const response = await postPaymentCalculation(payload, {
    calculationUri: options.calculationUri,
    headers: buildAuthHeader()
  })

  if (logger) {
    logger.info('Successfully called Land Grants WMP payment calculation')
  }

  const payment = response?.payment
  if (!payment) {
    throw new Error('Land Grants response missing "payment" field')
  }

  const { agreementStartDate, agreementEndDate } = payment
  if (!agreementStartDate || !agreementEndDate) {
    throw new Error(
      'Land Grants response missing agreementStartDate or agreementEndDate'
    )
  }

  return { agreementStartDate, agreementEndDate }
}

export { calculatePaymentsBasedOnParcelsWithActions, calculateWmpPaymentDates }
