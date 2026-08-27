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

export const checkPropertyExists = (property, targetObj) => {
  // Logic to map requested property to actual record fields
  const getVal = (target) => {
    switch (property) {
      case 'agreementNumber':
        return target.agreementNumber
      case 'version':
        return target.version
      case 'code':
        return target.code
      case 'clientRef':
        return target.clientRef
      case 'correlationId':
        return target.correlationId
      case 'identifiers':
        return target.identifiers
      case 'schemeCode':
        return target.scheme || target.schemeCode
      case 'name':
        return target.agreementName || target.name
      case 'applicant':
        return target.applicant
      case 'application':
        return target.application
      case 'startDate':
        // if its status is accepted then payment/dates should be present
        if ((target.status || '').toLowerCase() === 'accepted') {
          return target.payment?.agreementStartDate || target.startDate
        }
        return target.startDate
      case 'endDate':
        if ((target.status || '').toLowerCase() === 'accepted') {
          return target.payment?.agreementEndDate || target.endDate
        }
        return target.endDate
      case 'parcels':
        return target.application?.parcel || target.parcels
      case 'actions':
        return target.actionApplications || target.actions
      case 'items':
        return target.application?.agreement || target.items
      case 'annualAmountPence':
        return target.payment?.annualTotalPence || target.annualAmountPence
      case 'totalAmountPence':
        return target.payment?.agreementTotalPence || target.totalAmountPence
      case 'paymentSchedule':
        if ((target.status || '').toLowerCase() === 'accepted') {
          return target.payment?.payments
        }
        return target.payment?.payments || target.paymentSchedule
      case 'state': {
        const s = (target.status || target.state || '').toLowerCase()
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
      }
      case 'createdAt':
        return target.createdAt
      case 'updatedAt':
        return target.updatedAt
      case 'acceptedAt':
        return (target.status || '').toLowerCase() === 'accepted'
          ? target.signatureDate
          : ''
      default:
        return undefined
    }
  }

  const val = getVal(targetObj)
  return val !== undefined && val !== null
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
      const issues = []

      // Fetch all versions related to this agreement via its grants
      const grantIds = (agreement.grantDetails || []).map((g) => g._id)
      const versions = await mongoose.connection
        .collection('versions')
        .find({ grant: { $in: grantIds } })
        .toArray()

      let versionIndex = 0
      for (const version of versions) {
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

        ++versionIndex
      }

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
