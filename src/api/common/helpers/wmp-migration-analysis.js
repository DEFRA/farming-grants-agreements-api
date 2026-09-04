import mongoose from 'mongoose'
import { checkFileExists } from '#~/api/common/helpers/s3-client.js'
import { getRetentionPrefix } from '#~/api/common/helpers/retention-period.js'

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
const isWmpVersion = (version) =>
  version.code === 'woodland' || version.scheme === 'WMP'

const summariseVersionTypes = (versions) => {
  if (versions.length === 0) {
    return 'none'
  }

  const counts = versions.reduce((summary, version) => {
    const type = `${version.code || 'unknown'}/${version.scheme || version.schemeCode || 'unknown'}`
    summary[type] = (summary[type] || 0) + 1
    return summary
  }, {})

  return Object.entries(counts)
    .map(([type, count]) => `${type}:${count}`)
    .join(',')
}

const summariseVersionStatuses = (versions) => {
  if (versions.length === 0) {
    return 'none'
  }

  const counts = versions.reduce((summary, version) => {
    const status = (version.status || 'unknown').toLowerCase()
    summary[status] = (summary[status] || 0) + 1
    return summary
  }, {})

  return Object.entries(counts)
    .map(([status, count]) => `${status}:${count}`)
    .join(',')
}

const summariseIssues = (issues) => {
  if (issues.length === 0) {
    return 'none'
  }

  const groupedIssues = issues.reduce((summary, issue) => {
    const key = `${issue.reason}:${issue.path}`
    const affectedRecord = issue.versionId || 'agreement'
    const affectedRecords = summary.get(key) || new Set()
    affectedRecords.add(affectedRecord)
    summary.set(key, affectedRecords)
    return summary
  }, new Map())

  return Array.from(
    groupedIssues,
    ([issue, affectedRecords]) =>
      `${issue}@${Array.from(affectedRecords).join(',')}`
  ).join('|')
}

const reportAgreement = (agreement, versions, wmpVersions, issues) => {
  const migration = issues.length === 0 ? 'GOOD' : 'BAD'
  logger.info(
    `WMP_MIGRATION migration=${migration} agreement=${agreement.agreementNumber} agreementId=${agreement._id.toString()} agreementStatus=${agreement.status || 'unknown'} versions=${versions.length} wmpVersions=${wmpVersions.length} versionTypes=${summariseVersionTypes(versions)} versionStatuses=${summariseVersionStatuses(versions)} issues=${summariseIssues(issues)}`
  )
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

const validateItemsProperty = (target) => {
  const agreementLevelItems = target.payment?.agreementLevelItems
  const applicationAgreement = target.application?.agreement

  const hasAgreementLevelItems =
    agreementLevelItems instanceof Map
      ? agreementLevelItems.size > 0
      : agreementLevelItems && Object.keys(agreementLevelItems).length > 0
  const hasApplicationAgreement =
    Array.isArray(applicationAgreement) && applicationAgreement.length > 0

  if (hasAgreementLevelItems && hasApplicationAgreement) {
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
      return undefined
    }
    return agreementLevelItems
  }

  if (hasAgreementLevelItems) {
    return agreementLevelItems
  }

  if (hasApplicationAgreement) {
    return applicationAgreement
  }

  return undefined
}

const checkPropertyExists = (property, targetObj) => {
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
    items: validateItemsProperty,
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

const checkMissingProperties = (agreement, version) => {
  const issues = []
  requiredPropertiesOfAgreement.forEach((propertyKey) => {
    if (
      !checkPropertyExists(propertyKey, agreement) &&
      !checkPropertyExists(propertyKey, version)
    ) {
      issues.push({
        path: propertyKey,
        reason: 'MISSING_PROPERTY',
        versionId: version._id.toString()
      })
    }
  })
  return issues
}

const checkUnmappableStatus = (agreement, version) => {
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
      versionId: version._id.toString()
    })
  }
  return issues
}

const checkPaymentValues = (version) => {
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
      versionId: version._id.toString()
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
    return { issues, versions: [], wmpVersions: [] }
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
    return { issues, versions: [], wmpVersions: [] }
  }

  const wmpVersions = versions.filter(isWmpVersion)
  const nonWmpVersions = versions.filter((version) => !isWmpVersion(version))
  nonWmpVersions.forEach((version) => {
    issues.push({
      path: 'versions',
      reason: 'NON_WMP_VERSION_LINKED',
      versionId: version._id.toString()
    })
  })

  if (wmpVersions.length === 0) {
    issues.push({
      path: 'versions',
      reason: 'MISSING_WMP_VERSIONS'
    })
  }

  wmpVersions.forEach((version) => {
    issues.push(
      ...checkMissingProperties(agreement, version),
      ...checkUnmappableStatus(agreement, version),
      ...checkPaymentValues(version)
    )
  })
  return { issues, versions, wmpVersions }
}

async function ensureMongoConnection() {
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected) {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME })
  }
}

async function checkSingleAgreementPdf(agreement, bucket, stats) {
  logger.info(`WMP_PDF_CHECKING of agreement=${agreement.agreementNumber}`)
  const version = agreement.latestAcceptedVersion
  stats.inspected++
  const agreementId = agreement.agreementNumber
  const versionCount = agreement.totalVersionsCount || 1

  const prefix = getRetentionPrefix(
    version.payment?.agreementStartDate,
    version.payment?.agreementEndDate
  )
  const filename = `${agreementId}-${versionCount}.pdf`
  const key = [prefix, agreementId, versionCount, filename]
    .filter(Boolean)
    .join('/')

  try {
    const exists = await checkFileExists({ bucket, key })
    if (exists) {
      stats.passed++
      logger.info(
        `WMP_PDF_CHECK_PASS agreement=${agreementId} version=${versionCount} key=${key}`
      )
    } else {
      stats.failed++
      logger.error(
        `WMP_PDF_CHECK_FAIL agreement=${agreementId} version=${versionCount} key=${key} reason=NOT_FOUND`
      )
    }
  } catch (err) {
    stats.failed++
    logger.error(
      err,
      `WMP_PDF_CHECK_FAIL agreement=${agreementId} version=${versionCount} key=${key} reason=ERROR`
    )
  }
}

export async function runWMPAgreementDataAnalysis() {
  logger.info(`WMP_MIGRATION_ANALYSIS timestamp=${new Date().toISOString()}`)

  try {
    await ensureMongoConnection()
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
      const { issues, versions, wmpVersions } =
        await analyzeAgreementVersions(agreement)

      reportAgreement(agreement, versions, wmpVersions, issues)
      if (issues.length === 0) {
        stats.passed++
      } else {
        stats.failed++
      }
    }

    logger.info(
      `WMP_MIGRATION_SUMMARY agreements=${stats.inspected} good=${stats.passed} bad=${stats.failed} decision=${stats.failed === 0 ? 'GOOD' : 'BAD'}`
    )
  } catch (error) {
    logger.error(error, 'Analysis failed with error:')
  }
}

function fetchWmpAgreementsWithLatestAcceptedVersion() {
  return mongoose.connection.collection('agreements').aggregate([
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
    },
    {
      $lookup: {
        from: 'versions',
        let: { grantIds: '$grantDetails._id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: ['$grant', '$$grantIds']
              }
            }
          }
        ],
        as: 'allVersions'
      }
    },
    {
      $addFields: {
        totalVersionsCount: { $size: '$allVersions' },
        latestAcceptedVersion: {
          $filter: {
            input: '$allVersions',
            as: 'v',
            cond: { $eq: ['$$v.status', 'accepted'] }
          }
        }
      }
    },
    {
      $addFields: {
        latestAcceptedVersion: {
          $slice: [
            {
              $sortArray: {
                input: '$latestAcceptedVersion',
                sortBy: { createdAt: -1, _id: -1 }
              }
            },
            1
          ]
        }
      }
    },
    {
      $unwind: '$latestAcceptedVersion'
    },
    {
      $project: {
        allVersions: 0
      }
    }
  ])
}

export async function runWMPAgreementPDFAnalysis() {
  logger.info(`WMP_PDF_CHECK_START timestamp=${new Date().toISOString()}`)

  try {
    await ensureMongoConnection()

    const bucket = config.get('files.s3.bucket')
    if (!bucket) {
      logger.warn('FILES_S3_BUCKET not set - skipping PDF check')
      return
    }

    const wmpAgreementsCursor = fetchWmpAgreementsWithLatestAcceptedVersion()
    const allAgreements = await wmpAgreementsCursor.toArray()

    logger.info(`Fetched total=${allAgreements.length} WMP accepted agreements`)

    const stats = { inspected: 0, passed: 0, failed: 0 }

    for (const agreement of allAgreements) {
      await checkSingleAgreementPdf(agreement, bucket, stats)
    }

    logger.info(
      `WMP_PDF_CHECK_SUMMARY total_checks=${stats.inspected} passed=${stats.passed} failed=${stats.failed}`
    )
  } catch (error) {
    logger.error(error, 'WMP PDF check failed with error:')
  }
}
