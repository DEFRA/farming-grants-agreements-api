import { differenceInYears } from 'date-fns'
import { config } from '~/src/config/index.js'

/**
 * Get the S3 prefix for retention period based on agreement end date
 * @param {Date|string} startDate Agreement start date
 * @param {Date|string} endDate Agreement end date
 * @returns {string} S3 prefix for the retention period (e.g., "base", "extended", "maximum")
 */
export function getRetentionPrefix(startDate, endDate) {
  const yearsFromNow = differenceInYears(new Date(endDate), new Date(startDate))

  // Get base retention years from config
  const baseYears = config.get('files.s3.retentionBaseYears')
  const totalYears = yearsFromNow + baseYears

  // Get thresholds from config
  const baseThreshold = config.get('files.s3.baseTermThreshold')
  const extendedThreshold = config.get('files.s3.extendedTermThreshold')

  // Get prefixes from config
  const baseTermPrefix = config.get('files.s3.baseTermPrefix')
  const extendedTermPrefix = config.get('files.s3.extendedTermPrefix')
  const maximumTermPrefix = config.get('files.s3.maximumTermPrefix')

  // Determine which term prefix to use based on thresholds
  if (totalYears <= baseThreshold) {
    return baseTermPrefix
  } else if (totalYears <= extendedThreshold) {
    return extendedTermPrefix
  } else {
    return maximumTermPrefix
  }
}
