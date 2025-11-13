/**
 * Script to populate the database with 70,000 agreements for performance testing
 *
 * This script simulates 2 years worth of agreement data (35k agreements annually)
 * Usage: node scripts/populate-agreements.js [targetCount] [batchSize]
 * Example: node scripts/populate-agreements.js 100000 200
 */

import mongoose from 'mongoose'
import { config } from '../src/config/index.js'
import agreements from '../src/api/common/models/agreements.js'
import sampleData from '../src/api/common/helpers/sample-data/index.js'
import { createLogger } from '../src/api/common/helpers/logging/logger.js'

const logger = createLogger()

// Parse command line arguments with defaults
const TARGET_COUNT = parseInt(process.argv[2], 10) || 70000
const BATCH_SIZE = parseInt(process.argv[3], 10) || 100
const SAMPLE_TEMPLATES = sampleData.agreements

// MongoDB connection settings
const MONGO_URI = config.get('mongoUri')
const MONGO_DB = config.get('mongoDatabase')

// Pre-calculate date range boundaries for performance
const TWO_YEARS_AGO = new Date()
TWO_YEARS_AGO.setFullYear(TWO_YEARS_AGO.getFullYear() - 2)
const NOW = new Date()
const DATE_RANGE_MS = NOW.getTime() - TWO_YEARS_AGO.getTime()
const DATE_RANGE_START = TWO_YEARS_AGO.getTime()

/**
 * Generate a unique agreement number
 */
function generateAgreementNumber(index) {
  const paddedIndex = String(index).padStart(9, '0')
  return `SFI${paddedIndex}`
}

/**
 * Generate varied date strings for realistic distribution over 2 years
 */
function generateRandomDateInRange() {
  const randomTime = DATE_RANGE_START + Math.random() * DATE_RANGE_MS
  return new Date(randomTime).toISOString()
}

/**
 * Create a variation of the sample agreement data with unique identifiers
 */
function createAgreementVariation(index, timestamp) {
  // Rotate through sample templates
  const template = SAMPLE_TEMPLATES[index % SAMPLE_TEMPLATES.length]

  // Generate unique identifiers (using timestamp for uniqueness, not Date.now())
  const agreementNumber = generateAgreementNumber(index)
  const notificationMessageId = `notification-${index}-${timestamp}`
  const correlationId = `correlation-${index}-${timestamp}`
  const clientRef = `client-ref-${String(index).padStart(8, '0')}`

  // Vary the FRN and SBI for diversity
  const frnBase = 1000000000 + (index % 9000000000)
  const sbiBase = 100000000 + (index % 900000000)
  const frn = String(frnBase)
  const sbi = String(sbiBase)

  const createdAt = generateRandomDateInRange()

  // Build the agreement data
  const agreementData = {
    agreementNumber,
    clientRef,
    frn,
    sbi
  }

  // Build the version data with deep cloning to avoid reference issues
  const versionData = {
    notificationMessageId,
    agreementName: template.answers?.agreementName ?? `Agreement ${index}`,
    correlationId,
    clientRef,
    code: template.code ?? 'frps-private-beta',
    identifiers: {
      sbi,
      frn,
      crn: template.identifiers?.crn ?? 'crn',
      defraId: template.identifiers?.defraId ?? 'defraId'
    },
    status: 'offered',
    scheme: template.answers?.scheme ?? 'SFI',
    actionApplications: template.answers?.actionApplications ?? [],
    payment: template.answers?.payment ?? {},
    applicant: template.answers?.applicant ?? {},
    createdAt,
    updatedAt: createdAt
  }

  return {
    agreement: agreementData,
    versions: [versionData]
  }
}

/**
 * Process a batch of agreements
 */
async function processBatch(startIndex, batchSize) {
  const batchTimestamp = Date.now()
  const promises = []
  const errors = []

  for (let i = startIndex; i < startIndex + batchSize; i++) {
    const { agreement, versions } = createAgreementVariation(
      i,
      batchTimestamp + i
    )

    promises.push(
      agreements
        .createAgreementWithVersions({
          agreement,
          versions
        })
        .catch((err) => {
          errors.push({
            index: i,
            agreementNumber: agreement.agreementNumber,
            error: err.message
          })
          logger.error(
            { err, agreementNumber: agreement.agreementNumber },
            `Error creating agreement ${agreement.agreementNumber}`
          )
          return null
        })
    )
  }

  const results = await Promise.all(promises)
  const successCount = results.filter((r) => r !== null).length

  return { successCount, errorCount: errors.length, errors }
}

/**
 * Format time in human-readable format
 */
function formatTime(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}m ${secs}s`
}

/**
 * Estimate time remaining
 */
function estimateTimeRemaining(elapsed, completed, total) {
  if (completed === 0) return 'calculating...'
  const rate = completed / elapsed
  const remaining = (total - completed) / rate
  return formatTime(remaining)
}

/**
 * Main execution function
 */
async function main() {
  logger.info('Starting database population...')
  logger.info(`Target: ${TARGET_COUNT.toLocaleString()} agreements`)
  logger.info(`Batch size: ${BATCH_SIZE}`)
  logger.info(`Database: ${MONGO_DB}`)
  logger.info('')

  // Validate inputs
  if (TARGET_COUNT <= 0 || BATCH_SIZE <= 0) {
    throw new Error('TARGET_COUNT and BATCH_SIZE must be positive numbers')
  }

  if (BATCH_SIZE > 1000) {
    logger.warn(
      'Warning: Large batch sizes (>1000) may cause memory issues. Consider using a smaller batch size.'
    )
  }

  const startTime = Date.now()
  let totalCreated = 0
  let totalErrors = 0

  try {
    // Connect to MongoDB with optimized settings for bulk operations
    logger.info('Connecting to MongoDB...')
    await mongoose.connect(`${MONGO_URI}${MONGO_DB}`, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5
    })
    logger.info('Connected to MongoDB')
    logger.info('')

    // Check existing count
    const existingCount = await agreements.countDocuments()
    logger.info(
      `Existing agreements in database: ${existingCount.toLocaleString()}`
    )

    if (existingCount > 0) {
      logger.warn('Warning: Database already contains agreements.')
      logger.warn(
        '   This script will add more agreements on top of existing ones.'
      )
      logger.warn('   Agreement numbers will start from index 0.')
      logger.info('')
    }

    // Process in batches
    const totalBatches = Math.ceil(TARGET_COUNT / BATCH_SIZE)
    logger.info(`Processing ${totalBatches} batches...`)
    logger.info('')

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const startIndex = batchNum * BATCH_SIZE
      const currentBatchSize = Math.min(BATCH_SIZE, TARGET_COUNT - startIndex)

      const { successCount, errorCount } = await processBatch(
        startIndex,
        currentBatchSize
      )
      totalCreated += successCount
      totalErrors += errorCount

      const percentComplete = (((batchNum + 1) / totalBatches) * 100).toFixed(1)
      const elapsed = (Date.now() - startTime) / 1000
      const rate = (totalCreated / elapsed).toFixed(0)
      const eta = estimateTimeRemaining(elapsed, totalCreated, TARGET_COUNT)

      // Progress update with more information
      process.stdout.write(
        `\rProgress: ${totalCreated.toLocaleString()}/${TARGET_COUNT.toLocaleString()} ` +
          `(${percentComplete}%) | ` +
          `${rate} agreements/sec | ` +
          `ETA: ${eta} | ` +
          `Errors: ${totalErrors}`
      )

      // Detailed progress every 10 batches
      if ((batchNum + 1) % 10 === 0) {
        process.stdout.write('\n')
      }
    }

    process.stdout.write('\n\n')

    // Final statistics
    const endTime = Date.now()
    const totalTime = (endTime - startTime) / 1000
    const avgRate = (totalCreated / totalTime).toFixed(0)
    const successRate = ((totalCreated / TARGET_COUNT) * 100).toFixed(2)

    logger.info('Population complete!')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info(`Total agreements created: ${totalCreated.toLocaleString()}`)
    logger.info(`Total errors: ${totalErrors.toLocaleString()}`)
    logger.info(`Success rate: ${successRate}%`)
    logger.info(`Total time: ${formatTime(totalTime)}`)
    logger.info(`Average rate: ${avgRate} agreements/sec`)

    const finalCount = await agreements.countDocuments()
    logger.info(`Final database count: ${finalCount.toLocaleString()}`)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    if (totalCreated < TARGET_COUNT) {
      logger.warn(
        `Warning: Only ${totalCreated} of ${TARGET_COUNT} agreements were created successfully`
      )
    }

    // Exit with appropriate code
    process.exitCode = totalErrors > 0 ? 1 : 0
  } catch (error) {
    logger.error({ err: error }, 'Error during population')
    throw error
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect()
    logger.info('Disconnected from MongoDB')
  }
}

// Execute the script
main().catch((error) => {
  logger.error({ err: error }, 'Fatal error')
  process.exitCode = 1
})
