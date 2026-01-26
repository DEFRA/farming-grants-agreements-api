/**
 * Formats a YYYY-MM-DD date string into DD/MM/YYYY.
 * @param {string} paymentDate
 * @returns {string}
 */
function formatPaymentDate(paymentDate) {
  if (typeof paymentDate !== 'string') {
    throw new Error('Payment date must be a string')
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(paymentDate)
  if (!match) {
    throw new Error('Payment date must be in YYYY-MM-DD format')
  }

  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

const ddmmyyyyPattern = /^\d{2}\/\d{2}\/\d{4}$/

/**
 * Validates an optional DD/MM/YYYY date string.
 * @param {string} value
 * @param {string} fieldName
 */
function validateOptionalPaymentDate(value, fieldName) {
  if (value === '') {
    return
  }

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`)
  }

  if (!ddmmyyyyPattern.test(value)) {
    throw new Error(`${fieldName} must be in DD/MM/YYYY format`)
  }
}

export { formatPaymentDate, validateOptionalPaymentDate }
