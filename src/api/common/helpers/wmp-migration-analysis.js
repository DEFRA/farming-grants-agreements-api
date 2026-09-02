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

const validateIdentifiers = (target) => {
  const ids = target.identifiers
  if (!ids) {
    return undefined
  }
  if (!ids.sbi || !ids.frn || !ids.crn) {
    return undefined
  }
  return ids
}

const validateApplicant = (target) => {
  const applicant = target.applicant
  if (!applicant) {
    return undefined
  }
  if (
    !applicant.business?.name ||
    !applicant.business?.address ||
    !applicant.customer?.name?.first ||
    !applicant.customer?.name?.last
  ) {
    return undefined
  }
  return applicant
}

const getAgreementDate = (target, type) => {
  if ((target.status || '').toLowerCase() === 'accepted') {
    if (type === 'start') {
      return target.payment?.agreementStartDate
    }
    return target.payment?.agreementEndDate || target.endDate
  }
  return 'ignore_to_log'
}

const validateParcelsProperty = (target) => {
  const parcels = target.application?.parcel
  return Array.isArray(parcels) && parcels.length > 0 ? parcels : undefined
}

const validateActionsProperty = (target) => {
  const actions = target.actionApplications
  return Array.isArray(actions) && actions.length > 0 ? actions : undefined
}

const validateItemsProperty = (target, agreementNumber) => {
  const agreementLevelItems = target.payment?.agreementLevelItems
  const applicationAgreement = target.application?.agreement

  const hasAgreementLevelItems =
    agreementLevelItems instanceof Map
      ? agreementLevelItems.size > 0
      : agreementLevelItems && Object.keys(agreementLevelItems).length > 0
  const hasApplicationAgreement =
    Array.isArray(applicationAgreement) && applicationAgreement.length > 0

  if (hasAgreementLevelItems && hasApplicationAgreement) {
    logger.info(
      `Found both payment.agreementLevelItems and application.agreement for agreement ${agreementNumber}`
    )
    // Verify shared fields agree
    const aliArray =
      agreementLevelItems instanceof Map
        ? Array.from(agreementLevelItems.values())
        : Object.values(agreementLevelItems)

    const mismatches = []
    aliArray.forEach((ali) => {
      const matchingAppAg = applicationAgreement.find(
        (aa) => aa.code === ali.code
      )
      if (!matchingAppAg) {
        mismatches.push(`Missing code ${ali.code} in application.agreement`)
      } else if (
        matchingAppAg.description !== ali.description ||
        matchingAppAg.annualPaymentPence !== ali.annualPaymentPence
      ) {
        mismatches.push(`Data mismatch for code ${ali.code}`)
      } else {
        // Shared fields match, no action needed
      }
    })

    if (mismatches.length > 0) {
      logger.info(
        `Shared fields mismatch for agreement ${agreementNumber}: ${mismatches.join(', ')}`
      )
      return undefined
    }
    return agreementLevelItems
  }

  if (hasAgreementLevelItems) {
    logger.info(
      `Found payment.agreementLevelItems legacy shape for agreement ${agreementNumber}`
    )
    return agreementLevelItems
  }

  if (hasApplicationAgreement) {
    logger.info(
      `Found application.agreement legacy shape for agreement ${agreementNumber}`
    )
    return applicationAgreement
  }

  return undefined
}

const checkPropertyExists = (property, targetObj, agreementNumber) => {
  // Logic to map requested property to actual record fields
  const propertyHandlers = {
    agreementNumber: (target) => target.agreementNumber,
    version: (target) => target.version,
    code: (target) => target.code,
    clientRef: (target) => target.clientRef,
    correlationId: (target) => target.correlationId,
    identifiers: validateIdentifiers,
    schemeCode: (target) => target.scheme || target.schemeCode,
    name: (target) => target.agreementName || target.name,
    applicant: validateApplicant,
    application: (target) => target.application,
    startDate: (target) => getAgreementDate(target, 'start'),
    endDate: (target) => getAgreementDate(target, 'end'),
    parcels: validateParcelsProperty,
    actions: validateActionsProperty,
    items: (target) => validateItemsProperty(target, agreementNumber),
    annualAmountPence: (target) => target.payment?.annualTotalPence,
    totalAmountPence: (target) => target.payment?.agreementTotalPence,
    paymentSchedule: (target) => {
      const payments = target.payment?.payments
      return Array.isArray(payments) && payments.length > 0
        ? payments
        : undefined
    },
    state: (target) => {
      const s = (target.status || '').toLowerCase()
      return ['accepted', 'offered'].includes(s) ? s : undefined
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
      !checkPropertyExists(propertyKey, agreement, agreement.agreementNumber) &&
      !checkPropertyExists(propertyKey, version, agreement.agreementNumber)
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

const checkUnmappableStatus = (agreement, version, versionIndex) => {
  const issues = []
  const status = (version.status || agreement.status || '').toLowerCase()
  const unmappableStatuses = [
    'cancelled',
    'withdrawn',
    'rejected',
    'terminated'
  ]

  if (unmappableStatuses.includes(status)) {
    issues.push({
      path: 'status',
      reason: 'STATUS_UNMAPPABLE',
      message: `Status '${status}' is unmappable in agreement or version[${versionIndex}] ${version._id.toString()}`
    })
  }
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

  if (!agreement.grantDetails || agreement.grantDetails.length === 0) {
    issues.push({
      path: 'grantDetails',
      reason: 'MISSING_GRANTS',
      message: 'Agreement has no associated grants'
    })
    return issues
  }

  const grantIds = agreement.grantDetails.map((g) => g._id)
  const versions = await mongoose.connection
    .collection('versions')
    .find({ grant: { $in: grantIds } })
    .toArray()

  if (!versions || versions.length === 0) {
    issues.push({
      path: 'versions',
      reason: 'MISSING_VERSIONS',
      message: `No versions found for grants: ${grantIds.join(', ')}`
    })
    return issues
  }

  versions.forEach((version, index) => {
    issues.push(
      ...checkMissingProperties(agreement, version, index),
      ...checkUnmappableStatus(agreement, version, index),
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
