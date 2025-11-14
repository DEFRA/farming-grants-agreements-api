import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import {
  populateAgreements,
  DEFAULT_TARGET_COUNT,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY
} from '~/src/api/test-endpoints/helpers/populate-agreements.js'

const MAX_TARGET_COUNT = 100000
const MAX_BATCH_SIZE = 1000

const parseNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

const validateInputs = (targetCount, batchSize, concurrency) => {
  if (!Number.isInteger(targetCount) || targetCount <= 0) {
    throw Boom.badRequest('targetCount must be a positive integer')
  }
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw Boom.badRequest('batchSize must be a positive integer')
  }
  if (targetCount > MAX_TARGET_COUNT) {
    throw Boom.badRequest(`targetCount must not exceed ${MAX_TARGET_COUNT}`)
  }
  if (batchSize > MAX_BATCH_SIZE) {
    throw Boom.badRequest(`batchSize must not exceed ${MAX_BATCH_SIZE}`)
  }
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw Boom.badRequest('concurrency must be a positive integer')
  }
  if (concurrency > MAX_CONCURRENCY) {
    throw Boom.badRequest(`concurrency must not exceed ${MAX_CONCURRENCY}`)
  }
}

/**
 * Controller to populate agreements collection with synthetic data.
 * Allows test teams to trigger bulk inserts via HTTP.
 * @satisfies {Partial<ServerRoute>}
 */
const postTestPopulateAgreementsController = {
  options: {
    description: 'Populate agreements with sample data for performance testing',
    tags: ['api', 'test'],
    auth: false,
    timeout: {
      server: false,
      socket: false
    }
  },
  handler: (request, h) => {
    const payload = request.payload ?? {}

    const targetCount = parseNumber(payload.targetCount, DEFAULT_TARGET_COUNT)
    const batchSize = parseNumber(payload.batchSize, DEFAULT_BATCH_SIZE)
    const concurrency = parseNumber(payload.concurrency, DEFAULT_CONCURRENCY)

    validateInputs(targetCount, batchSize, concurrency)

    const jobId = `populate-${Date.now()}`

    const jobLogger = request.logger.child({
      jobId,
      targetCount,
      batchSize,
      concurrency
    })

    if (!request.server.app.populateJobs) {
      request.server.app.populateJobs = new Map()
    }
    const jobs = request.server.app.populateJobs
    jobs.set(jobId, {
      status: 'running',
      startedAt: new Date().toISOString(),
      parameters: { targetCount, batchSize, concurrency }
    })

    jobLogger.info(
      'Agreement population job queued. Processing will continue in the background.'
    )

    setImmediate(() => {
      populateAgreements({
        targetCount,
        batchSize,
        concurrency,
        logger: jobLogger
      })
        .then((result) => {
          jobs.set(jobId, {
            status: 'completed',
            finishedAt: new Date().toISOString(),
            result
          })
          return jobLogger.info(
            {
              summary: result.summary,
              totalErrors: result.summary.totalErrors,
              errorSampleCount: result.errors.length,
              hasMoreErrors: result.hasMoreErrors
            },
            'Agreement population job completed'
          )
        })
        .catch((error) => {
          jobs.set(jobId, {
            status: 'failed',
            finishedAt: new Date().toISOString(),
            error: error.message
          })
          return jobLogger.error(
            { err: error },
            'Agreement population job failed'
          )
        })
    })

    return h
      .response({
        message: 'Agreement population job started',
        parameters: {
          targetCount,
          batchSize,
          concurrency
        }
      })
      .code(statusCodes.accepted)
  }
}

export { postTestPopulateAgreementsController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
