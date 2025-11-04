import { differenceInYears } from 'date-fns'

/**
 * Calculate retention period based on years from now until agreement end date
 * @param {Date|string} endDate Agreement end date
 * @returns {number} Retention period (10, 15, or 20 years)
 */
export function calculateRetentionPeriod(endDate) {
  const yearsFromNow = differenceInYears(new Date(endDate), new Date())

  // Add 7 years for retention
  const totalYears = yearsFromNow + 7

  // Assign retention period based on thresholds
  if (totalYears <= 10) {
    return 10
  } else if (totalYears <= 15) {
    return 15
  } else {
    return 20
  }
}
