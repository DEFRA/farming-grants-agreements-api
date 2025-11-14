import mongoose from 'mongoose'
import agreements from '~/src/api/common/models/agreements.js'
import versionsModel from '~/src/api/common/models/versions.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'
import crypto from 'crypto'

const DEFAULT_TARGET_COUNT = 70000
const DEFAULT_BATCH_SIZE = 1000
const DEFAULT_CONCURRENCY = 4
const MAX_CONCURRENCY = 10
const ERROR_SAMPLE_LIMIT = 25
const AGREEMENT_NUMBER_PAD_LENGTH = 9
const CLIENT_REF_PAD_LENGTH = 8
const FRN_BASE = 1000000000
const FRN_RANGE = 9000000000
const SBI_BASE = 100000000
const SBI_RANGE = 900000000
const BATCH_LOG_INTERVAL = 10

const SAMPLE_TEMPLATES = sampleData.agreements

const safeStructuredClone =
  typeof structuredClone === 'function'
    ? structuredClone
    : (value) => JSON.parse(JSON.stringify(value))

const cloneValue = (value, fallback) => {
  if (value === undefined || value === null) {
    return fallback
  }
  return safeStructuredClone(value)
}

const createDateRange = () => {
  const now = Date.now()
  const twoYearsAgo = new Date(now)
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  return {
    startMs: twoYearsAgo.getTime(),
    rangeMs: now - twoYearsAgo.getTime()
  }
}

const generateAgreementNumber = (index) =>
  `SFI${String(index).padStart(AGREEMENT_NUMBER_PAD_LENGTH, '0')}`

const generateRandomDateInRange = ({ startMs, rangeMs }) => {
  const r =
    Number(crypto.randomBytes(8).readBigUInt64BE()) /
    Number('0xFFFFFFFFFFFFFFFF')
  return new Date(startMs + r * rangeMs).toISOString()
}

const createAgreementVariation = (index, timestamp, dateRange) => {
  const template = SAMPLE_TEMPLATES[index % SAMPLE_TEMPLATES.length]
  const agreementId = new mongoose.Types.ObjectId()
  const versionId = new mongoose.Types.ObjectId()

  const agreementNumber = generateAgreementNumber(index)
  const notificationMessageId = `notification-${index}-${timestamp}`
  const correlationId = `correlation-${index}-${timestamp}`
  const clientRef = `client-ref-${String(index).padStart(
    CLIENT_REF_PAD_LENGTH,
    '0'
  )}`

  const frnBase = FRN_BASE + (index % FRN_RANGE)
  const sbiBase = SBI_BASE + (index % SBI_RANGE)
  const frn = String(frnBase)
  const sbi = String(sbiBase)

  const createdAt = generateRandomDateInRange(dateRange)

  return {
    agreement: {
      _id: agreementId,
      agreementNumber,
      clientRef,
      frn,
      sbi,
      versions: [versionId]
    },
    version: {
      _id: versionId,
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
      actionApplications: cloneValue(template.answers?.actionApplications, []),
      payment: cloneValue(template.answers?.payment, {}),
      applicant: cloneValue(template.answers?.applicant, {}),
      createdAt,
      updatedAt: createdAt,
      agreement: agreementId
    }
  }
}

const processBatch = async ({ startIndex, batchSize, dateRange, logger }) => {
  const batchTimestamp = Date.now()
  const batchErrors = []
  const agreementDocs = []
  const versionDocs = []

  for (let i = startIndex; i < startIndex + batchSize; i++) {
    const { agreement, version } = createAgreementVariation(
      i,
      batchTimestamp + i,
      dateRange
    )
    agreementDocs.push(agreement)
    versionDocs.push(version)
  }

  const agreementIds = agreementDocs.map((doc) => doc._id)
  let insertedCount = 0

  try {
    await agreements.insertMany(agreementDocs, { ordered: true })
    await versionsModel
      .insertMany(versionDocs, { ordered: true })
      .catch(async (err) => {
        await agreements.deleteMany({ _id: { $in: agreementIds } })
        throw err
      })
    insertedCount = agreementDocs.length
  } catch (err) {
    const firstAgreement = agreementDocs[0]?.agreementNumber
    const lastAgreement = agreementDocs.at(-1)?.agreementNumber
    batchErrors.push({
      agreementRange:
        firstAgreement && lastAgreement
          ? `${firstAgreement} - ${lastAgreement}`
          : undefined,
      message: err.message
    })
    logger?.error({ err }, 'Bulk insert error during populateAgreements')
  }

  return { successCount: insertedCount, errors: batchErrors }
}

const formatSeconds = (seconds) => {
  if (!seconds || seconds < 1) {
    return `${seconds.toFixed(2)}s`
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins === 0) {
    return `${secs}s`
  }
  return `${mins}m ${secs}s`
}

const addErrorSamples = (errorsSample, errors) => {
  if (!errors.length || errorsSample.length >= ERROR_SAMPLE_LIMIT) {
    return
  }
  const availableSlots = ERROR_SAMPLE_LIMIT - errorsSample.length
  errorsSample.push(...errors.slice(0, availableSlots))
}

const shouldLogBatch = (batchNumber, totalBatches) => {
  const progressBatchNumber = batchNumber + 1
  return (
    progressBatchNumber % BATCH_LOG_INTERVAL === 0 ||
    progressBatchNumber === totalBatches
  )
}

const logBatchStats = (
  logger,
  batchNumber,
  totalBatches,
  successCount,
  errors
) => {
  if (!logger) {
    return
  }
  logger.info(
    `[populate-agreements] Batch ${batchNumber + 1}/${totalBatches} complete (created ${successCount}, errors ${errors.length})`
  )
}

const calculateSafeConcurrency = (requestedConcurrency, totalBatches) => {
  const desired = Number.isInteger(requestedConcurrency)
    ? requestedConcurrency
    : DEFAULT_CONCURRENCY
  return Math.max(1, Math.min(desired, MAX_CONCURRENCY, totalBatches))
}

const processAllBatches = async ({
  targetCount,
  batchSize,
  totalBatches,
  safeConcurrency,
  dateRange,
  logger
}) => {
  const errorsSample = []
  let totalErrors = 0
  let totalCreated = 0
  let nextBatchNumber = 0

  const createBatchPromise = (batchNumber) => {
    const startIndex = batchNumber * batchSize
    const currentBatchSize = Math.min(batchSize, targetCount - startIndex)
    return processBatch({
      startIndex,
      batchSize: currentBatchSize,
      dateRange,
      logger
    }).then((result) => ({
      ...result,
      batchNumber
    }))
  }

  while (nextBatchNumber < totalBatches) {
    const batchPromises = []
    for (
      let concurrentIndex = 0;
      concurrentIndex < safeConcurrency && nextBatchNumber < totalBatches;
      concurrentIndex++
    ) {
      batchPromises.push(createBatchPromise(nextBatchNumber))
      nextBatchNumber++
    }

    const batchResults = await Promise.all(batchPromises)
    for (const { successCount, errors, batchNumber } of batchResults) {
      totalCreated += successCount
      totalErrors += errors.length
      addErrorSamples(errorsSample, errors)
      if (shouldLogBatch(batchNumber, totalBatches)) {
        logBatchStats(logger, batchNumber, totalBatches, successCount, errors)
      }
    }
  }

  return { totalCreated, totalErrors, errorsSample }
}

const populateAgreements = async ({
  targetCount = DEFAULT_TARGET_COUNT,
  batchSize = DEFAULT_BATCH_SIZE,
  concurrency = DEFAULT_CONCURRENCY,
  logger
}) => {
  const startTime = Date.now()
  const dateRange = createDateRange()
  const totalBatches = Math.ceil(targetCount / batchSize)
  const safeConcurrency = calculateSafeConcurrency(concurrency, totalBatches)

  const { totalCreated, totalErrors, errorsSample } = await processAllBatches({
    targetCount,
    batchSize,
    totalBatches,
    safeConcurrency,
    dateRange,
    logger
  })

  const elapsedSeconds = (Date.now() - startTime) / 1000
  const averageRate = elapsedSeconds
    ? Number((totalCreated / elapsedSeconds).toFixed(2))
    : totalCreated
  const successRate = targetCount
    ? Number(((totalCreated / targetCount) * 100).toFixed(2))
    : 0
  const finalDatabaseCount = await agreements.countDocuments()

  return {
    summary: {
      targetCount,
      batchSize,
      totalBatches,
      totalCreated,
      totalErrors,
      elapsedSeconds,
      elapsedFormatted: formatSeconds(elapsedSeconds),
      averageRate,
      successRate,
      finalDatabaseCount,
      concurrency: safeConcurrency
    },
    errors: errorsSample,
    hasMoreErrors: totalErrors > errorsSample.length,
    errorSampleLimit: ERROR_SAMPLE_LIMIT
  }
}

export {
  populateAgreements,
  DEFAULT_TARGET_COUNT,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY,
  ERROR_SAMPLE_LIMIT
}

/**
 * @typedef {object} PopulateAgreementsOptions
 * @property {number} [targetCount]
 * @property {number} [batchSize]
 * @property {import('pino').Logger} [logger]
 */
