const MAX_PENCE_VALUE = 99999999999999
const PENCE_PER_UNIT = 100

/**
 * Convert an integer pence value into a decimal currency value.
 * @param {number} valueInPence
 * @returns {number}
 */
const formatPaymentDecimal = (valueInPence) => {
  if (!Number.isFinite(valueInPence)) {
    throw new TypeError('Payment value must be a finite number')
  }

  if (!Number.isInteger(valueInPence)) {
    throw new TypeError('Payment value must be an integer number of pence')
  }

  if (valueInPence < 0 || valueInPence > MAX_PENCE_VALUE) {
    throw new RangeError(
      `Payment value must be between 0 and ${MAX_PENCE_VALUE}`
    )
  }

  return Number((valueInPence / PENCE_PER_UNIT).toFixed(2))
}

export { formatPaymentDecimal }
