import mongoose from 'mongoose'

import { createLogger } from '#~/api/common/helpers/logging/logger.js'
import { config } from '#~/config/index.js'

const logger = createLogger()

const MONGO_URI = config.get('mongoUri')
const DB_NAME = config.get('mongoDatabase')

const requiredPropertiesOfAgreement = [
  'agreementNumber',
  'code',
  'clientRef',
  'correlationId',
  'identifiers',
  'schemeCode',
  'name',
  'applicant',
  'application',
  'startDate',
  'endDate',
  'parcels',
  'actions',
  'items',
  'annualAmountPence',
  'totalAmountPence',
  'paymentSchedule',
  'state',
  'createdAt',
  'updatedAt',
  'acceptedAt'
]

/**
 * Diagnostic reporting helpers
 */
const reportPass = (agreementNumber, agreementId, status) => {
  logger.info(
    `[PASS] agreement=${agreementNumber} agreementId=${agreementId} status=${status} (READY)`
  )
}

const reportFailures = (agreementNumber, agreementId, issues) => {
  logger.info(
    `[FAIL] agreement=${agreementNumber} agreementId=${agreementId} status=BLOCKED`
  )
  issues.forEach((issue) => {
    const messagePart = issue.message ? ` (${issue.message})` : ''
    logger.info(`  - path=${issue.path} reason=${issue.reason}${messagePart}`)
  })
}

const checkPropertyExists = (property, targetObj) => {
  // Logic to map requested property to actual record fields
  const propertyHandlers = {
    agreementNumber: (target) => target.agreementNumber,
    version: (target) => target.version,
    code: (target) => target.code,
    clientRef: (target) => target.clientRef,
    correlationId: (target) => target.correlationId,
    identifiers: (target) => target.identifiers,
    schemeCode: (target) => target.scheme || target.schemeCode,
    name: (target) => target.agreementName || target.name,
    applicant: (target) => target.applicant,
    application: (target) => target.application,
    startDate: (target) => {
      if ((target.status || '').toLowerCase() === 'accepted') {
        return target.payment?.agreementStartDate
      }
      return 'ignore_to_log'
    },
    endDate: (target) => {
      if ((target.status || '').toLowerCase() === 'accepted') {
        return target.payment?.agreementEndDate || target.endDate
      }
      return 'ignore_to_log'
    },
    parcels: (target) => target.application?.parcel,
    actions: (target) => target.actionApplications,
    items: (target) => target.application?.agreement,
    annualAmountPence: (target) => target.payment?.annualTotalPence,
    totalAmountPence: (target) => target.payment?.agreementTotalPence,
    paymentSchedule: (target) => target.payment?.payments,
    state: (target) => {
      const s = (target.status || '').toLowerCase()
      return [
        'accepted',
        'cancelled',
        'withdrawn',
        'offered',
        'rejected',
        'terminated'
      ].includes(s)
        ? s
        : undefined
    },
    createdAt: (target) => target.createdAt,
    updatedAt: (target) => target.updatedAt,
    acceptedAt: (target) =>
      (target.status || '').toLowerCase() === 'accepted'
        ? target.signatureDate
        : 'ignore_to_log'
  }

  const handler = propertyHandlers[property]
  const val = handler ? handler(targetObj) : undefined
  return val !== undefined && val !== null && val !== ''
}

const checkMissingProperties = (agreement, version, versionIndex) => {
  const issues = []
  requiredPropertiesOfAgreement.forEach((propertyKey) => {
    if (
      !checkPropertyExists(propertyKey, agreement) &&
      !checkPropertyExists(propertyKey, version)
    ) {
      issues.push({
        path: propertyKey,
        reason: 'MISSING_PROPERTY',
        message: `Property '${propertyKey}' is missing in agreement and version[${versionIndex}] ${version._id.toString()}`
      })
    }
  })
  return issues
}

const checkPaymentValues = (version, versionIndex) => {
  const issues = []
  const annualTotalPence = version.payment?.annualTotalPence
  const agreementTotalPence = version.payment?.agreementTotalPence
  const firstPaymentTotalPence =
    version.payment?.payments?.[0]?.totalPaymentPence

  if (
    annualTotalPence !== undefined &&
    agreementTotalPence !== undefined &&
    firstPaymentTotalPence !== undefined &&
    (annualTotalPence !== agreementTotalPence ||
      annualTotalPence !== firstPaymentTotalPence)
  ) {
    issues.push({
      path: 'payment',
      reason: 'INVALID_PAYMENT_VALUES',
      message: `Property 'payment' payment values are different in version[${versionIndex}] ${version._id.toString()}`
    })
  }
  return issues
}

const analyzeAgreementVersions = async (agreement) => {
  const issues = []
  const grantIds = (agreement.grantDetails || []).map((g) => g._id)
  const versions = await mongoose.connection
    .collection('versions')
    .find({ grant: { $in: grantIds } })
    .toArray()

  versions.forEach((version, index) => {
    issues.push(
      ...checkMissingProperties(agreement, version, index),
      ...checkPaymentValues(version, index)
    )
  })
  return issues
}

export async function runWMPAgreementDataAnalysis() {
  logger.info('WMP Migration Analysis Report')
  logger.info(`Timestamp: ${new Date().toISOString()}`)

  try {
    if (
      mongoose.connection.readyState !== mongoose.ConnectionStates.connected
    ) {
      await mongoose.connect(MONGO_URI, { dbName: DB_NAME })
    }
    const wmpAgreements = mongoose.connection
      .collection('agreements')
      .aggregate([
        {
          $match: {
            agreementNumber: { $regex: /^WMP/ }
          }
        },
        {
          $lookup: {
            from: 'grants',
            localField: 'grants',
            foreignField: '_id',
            as: 'grantDetails'
          }
        }
      ])

    const stats = { inspected: 0, passed: 0, failed: 0 }

    for await (const agreement of wmpAgreements) {
      stats.inspected++
      const agreementNumber = agreement.agreementNumber
      const agreementId = agreement._id.toString()

      const issues = await analyzeAgreementVersions(agreement)

      if (issues.length === 0) {
        reportPass(agreementNumber, agreementId, agreement.status || 'N/A')
        stats.passed++
      } else {
        reportFailures(agreementNumber, agreementId, issues)
        stats.failed++
      }
    }

    logger.info('\n--- Analysis Summary ---')
    logger.info(`Total Versions Inspected: ${stats.inspected}`)
    logger.info(`Total Passed: ${stats.passed}`)
    logger.info(`Total Failed: ${stats.failed}`)
    logger.info(
      `Go Decision: ${stats.failed === 0 ? 'YES' : 'NO (Fix blocking issues)'}`
    )
  } catch (error) {
    logger.error(error, 'Analysis failed with error:')
  }
}
