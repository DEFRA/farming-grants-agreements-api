import { config } from '~/src/config/index.js'
import { fetchWithTimeout } from '~/src/api/common/helpers/fetch.js'

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

export const toLandGrantsPayload = (actions = []) => {
  if (!Array.isArray(actions)) {
    throw new TypeError('actions must be an array')
  }

  const grouped = new Map()

  for (const action of actions) {
    if (!action?.sheetId || !action?.parcelId || !action?.code) {
      continue
    }

    const key = `${action.sheetId}|${action.parcelId}`
    const existing = grouped.get(key) ?? {
      sheetId: action.sheetId,
      parcelId: action.parcelId,
      actions: []
    }

    const quantity = parseQuantity(action.appliedFor?.quantity)
    if (quantity == null) {
      grouped.set(key, existing)
      continue
    }

    existing.actions.push({ code: action.code, quantity })
    grouped.set(key, existing)
  }

  return { parcel: Array.from(grouped.values()) }
}

const buildAuthHeader = () => {
  const token = config.get('landGrants.token')
  return { Authorization: `Bearer ${token}` }
}

const postPaymentCalculation = async (body, options = {}) => {
  const { headers: extraHeaders = {} } = options

  const landGrantsBaseUrl = config.get('landGrants.uri')
  const url = new URL('/payments/calculate', landGrantsBaseUrl)

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

export const convertParcelsToLandGrantsPayload = (parcels = []) => {
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

const calculatePaymentsBasedOnParcelsWithActions = async (parcels, logger) => {
  const { parcel } = convertParcelsToLandGrantsPayload(parcels)

  const payload = { parcel }

  if (logger) {
    logger.info(
      `Sending Land Grants payment calculation request ${JSON.stringify(payload, null, 2)}`
    )
  }

  const response = await postPaymentCalculation(payload, {
    headers: buildAuthHeader()
  })

  if (logger) {
    logger.info(
      `Successfully called Land Grants payment calculation, response received is
      ${JSON.stringify(response, null, 2)}`
    )
  }

  const payment = response?.payment
  if (!payment) {
    throw new Error('Land Grants response missing "payment" field')
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

export { calculatePaymentsBasedOnParcelsWithActions }
