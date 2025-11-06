import { differenceInYears } from 'date-fns'
import { config } from '~/src/config/index.js'

/**
 * Extract retention period number from S3 prefix (e.g., "agreements_10" -> 10)
 * @param {string} prefix S3 prefix string
 * @returns {number} Retention period in years
 */
function extractRetentionYears(prefix) {
  const match = /\d+/.exec(prefix)
  return match ? Number.parseInt(match[0], 10) : 0
}

/**
 * Calculate retention period based on years from now until agreement end date
 * @param {Date|string} endDate Agreement end date
 * @returns {number} Retention period (10, 15, or 20 years)
 */
export function calculateRetentionPeriod(endDate) {
  const yearsFromNow = differenceInYears(new Date(endDate), new Date())

  // Get base retention years from config
  const baseYears = config.get('files.s3.retentionBaseYears')
  const totalYears = yearsFromNow + baseYears

  // Extract retention thresholds from S3 prefix configuration
  const shortTermThreshold = extractRetentionYears(
    config.get('files.s3.retentionBasePrefix')
  )
  const mediumTermThreshold = extractRetentionYears(
    config.get('files.s3.retentionExtendedPrefix')
  )
  const longTermThreshold = extractRetentionYears(
    config.get('files.s3.retentionMaximumPrefix')
  )

  // Assign retention period based on thresholds
  if (totalYears <= shortTermThreshold) {
    return shortTermThreshold
  } else if (totalYears <= mediumTermThreshold) {
    return mediumTermThreshold
  } else {
    return longTermThreshold
  }
}
