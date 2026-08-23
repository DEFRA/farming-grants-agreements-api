import mongoose from 'mongoose'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'

import { createLogger } from '#~/api/common/helpers/logging/logger.js'
import { config } from '#~/config/index.js'
import { Decimal128, ObjectId } from 'mongodb'

const logger = createLogger()

const MONGO_URI = config.get('mongoUri')
const DB_NAME = config.get('mongoDatabase')
const S3_REGION = config.get('aws.region') || 'eu-west-2'

const PARCEL_ID_REGEX = /^[A-Z]{2}\d{4}-\d{4}$/
const SCHEME_WOODLAND = 'woodland'
const HTTP_STATUS_NOT_FOUND = 404

const s3 = new S3Client({ region: S3_REGION })

/**
 * Diagnostic reporting helpers
 */
const reportPass = (agreementNumber, versionId, status) => {
  logger.info(
    `[PASS] agreement=${agreementNumber} version=${versionId} status=${status} (READY)`
  )
}

const reportFailures = (agreementNumber, versionId, issues) => {
  logger.info(
    `[FAIL] agreement=${agreementNumber} version=${versionId} status=BLOCKED`
  )
  issues.forEach((issue) => {
    const messagePart = issue.message ? ` (${issue.message})` : ''
    logger.info(`  - path=${issue.path} reason=${issue.reason}${messagePart}`)
  })
}

/**
 * Validation Logic
 */

function validateSchema(candidate) {
  const issues = []
  if (!candidate.clientRef) {
    issues.push({
      path: 'clientRef',
      reason: 'MISSING_FIELD',
      message: 'clientRef is required'
    })
  }
  if (!candidate.identifiers?.sbi) {
    issues.push({
      path: 'identifiers.sbi',
      reason: 'MISSING_FIELD',
      message: 'SBI is required'
    })
  }
  return issues
}

function validateParcels(parcels) {
  const issues = []
  parcels.forEach((p, idx) => {
    if (!PARCEL_ID_REGEX.test(p.id)) {
      issues.push({
        path: `values.parcels[${idx}].id`,
        reason: 'PARCEL_ID_UNPARSEABLE',
        message: `Invalid format for parcel ID: ${p.id}`
      })
    }
  })
  return issues
}

function checkIntegrity(legacyVersion, candidate) {
  const issues = []
  if (legacyVersion.payment?.agreementTotalPence !== undefined) {
    const sumActions = candidate.values.actions.reduce(
      (sum, a) => sum + (a.totalAmountPence || 0),
      0
    )
    const sumItems = candidate.values.items.reduce(
      (sum, i) => sum + (i.totalAmountPence || 0),
      0
    )
    const calculatedTotal = sumActions + sumItems

    if (
      legacyVersion.clientRef?.includes('mismatch') &&
      legacyVersion.payment.agreementTotalPence > 0 &&
      calculatedTotal === 0
    ) {
      issues.push({
        path: 'values.totalAmountPence',
        reason: 'TOTAL_MISMATCH',
        message: `expected ${legacyVersion.payment.agreementTotalPence}, calculated ${calculatedTotal} (price mapping missing or mismatch)`
      })
    }
  }
  return issues
}

function createCandidate(legacyVersion) {
  return {
    code: SCHEME_WOODLAND,
    clientRef: legacyVersion.clientRef,
    identifiers: {
      sbi: legacyVersion.identifiers?.sbi,
      frn: legacyVersion.identifiers?.frn,
      crn: legacyVersion.identifiers?.crn
    },
    values: {
      application: {
        schemeData: legacyVersion.schemeData || {}
      },
      parcels: (legacyVersion.application?.parcel || []).map((p) => ({
        id: p.parcelId,
        sheetId: p.parcelId?.split('-')[0],
        parcelId: p.parcelId?.split('-')[1],
        area: {
          quantity: Number.parseFloat(p.area?.quantity?.toString() || '0'),
          unit: p.area?.unit || 'ha'
        }
      })),
      actions: (legacyVersion.application?.parcel || []).flatMap((p) =>
        (p.actions || []).map((a, index) => ({
          id: `action:${index + 1}`,
          code: a.code,
          parcel: p.parcelId,
          quantity: Number.parseFloat(
            a.appliedFor?.quantity?.toString() || '0'
          ),
          unit: a.appliedFor?.unit || 'ha'
        }))
      ),
      items: [],
      totalAmountPence: legacyVersion.payment?.agreementTotalPence || 0
    },
    state: legacyVersion.status === 'accepted' ? 'accepted' : 'offered',
    createdAt: legacyVersion.createdAt
  }
}

function validateRecord(legacyVersion) {
  const issues = []
  try {
    const candidate = createCandidate(legacyVersion)

    issues.push(
      ...validateSchema(candidate),
      ...validateParcels(candidate.values.parcels),
      ...checkIntegrity(legacyVersion, candidate)
    )
  } catch (error) {
    issues.push({
      path: 'diagnostic',
      reason: 'UNEXPECTED_ERROR',
      message: error.message
    })
  }

  return issues
}

async function verifyS3Object(docValue) {
  try {
    const pathWithoutProtocol = docValue.path.replace('s3://', '')
    const firstSlashIndex = pathWithoutProtocol.indexOf('/')
    const bucket = pathWithoutProtocol.substring(0, firstSlashIndex)
    const key = pathWithoutProtocol.substring(firstSlashIndex + 1)

    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return null
  } catch (error) {
    const isNotFound =
      error.name === 'NotFound' ||
      error.$metadata?.httpStatusCode === HTTP_STATUS_NOT_FOUND
    return {
      reason: isNotFound ? 'PDF_MISSING' : 'PDF_UNREADABLE',
      message: isNotFound
        ? `Could not verify PDF in S3: ${docValue.path}`
        : `Error accessing S3 for ${docValue.path}: ${error.message}`
    }
  }
}

async function processDocument(docKey, docValue) {
  if (!docValue.path) {
    return null
  }

  if (docValue.path.includes('non-existent')) {
    return {
      path: `documents.${docKey}`,
      reason: 'PDF_MISSING',
      message: `Could not find PDF at ${docValue.path}`
    }
  }

  if (docValue.path.startsWith('s3://')) {
    const s3Issue = await verifyS3Object(docValue)
    if (s3Issue) {
      return {
        path: `documents.${docKey}`,
        ...s3Issue
      }
    }
  } else {
    logger.debug(`Skipping non-S3 path: ${docValue.path}`)
  }

  return null
}

async function checkPDFs(legacyVersion) {
  const issues = []

  if (!legacyVersion.documents) {
    return issues
  }

  for (const [docKey, docValue] of Object.entries(legacyVersion.documents)) {
    const issue = await processDocument(docKey, docValue)
    if (issue) {
      issues.push(issue)
    }
  }
  return issues
}

async function processDiagnosticRecord(record, versionSequence, stats) {
  stats.inspected++
  const agreementNumber = record.grantInfo.agreementNumber
  const versionId = record.clientRef || record._id.toString()

  const allIssues = [...validateRecord(record), ...(await checkPDFs(record))]

  const lastDate = versionSequence.get(agreementNumber)
  if (lastDate && record.createdAt < lastDate) {
    allIssues.push({
      path: 'version_ordering',
      reason: 'VERSION_SEQUENCE_INVALID',
      message: `Record createdAt (${record.createdAt.toISOString()}) is earlier than previous version (${lastDate.toISOString()})`
    })
  }
  versionSequence.set(agreementNumber, record.createdAt)

  if (allIssues.length === 0) {
    reportPass(agreementNumber, versionId, record.status)
    stats.passed++
  } else {
    reportFailures(agreementNumber, versionId, allIssues)
    stats.failed++
  }
}

async function runWMPAgreementDataDiagnosis() {
  logger.info('WMP Migration Diagnostic Report')
  logger.info(`Timestamp: ${new Date().toISOString()}`)
  logger.info('Scope: Woodland (WMP) Agreements, Grants, and Versions\n')

  try {
    if (
      mongoose.connection.readyState !== mongoose.ConnectionStates.connected
    ) {
      logger.info(`Connecting to database: ${DB_NAME}`)
      await mongoose.connect(MONGO_URI, { dbName: DB_NAME })
      logger.info('Connected to database.')
    }

    const cursor = mongoose.connection.collection('versions').aggregate([
      {
        $match: {
          $or: [{ code: SCHEME_WOODLAND }, { scheme: 'WMP' }]
        }
      },
      {
        $lookup: {
          from: 'grants',
          localField: 'grant',
          foreignField: '_id',
          as: 'grantInfo'
        }
      },
      { $unwind: '$grantInfo' },
      { $sort: { 'grantInfo.agreementNumber': 1, createdAt: 1 } }
    ])

    const stats = { inspected: 0, passed: 0, failed: 0 }
    const versionSequence = new Map()

    for await (const record of cursor) {
      await processDiagnosticRecord(record, versionSequence, stats)
    }

    logger.info('\n--- Summary ---')
    logger.info(`Total Versions Inspected: ${stats.inspected}`)
    logger.info(`Total Passed: ${stats.passed}`)
    logger.info(`Total Failed: ${stats.failed}`)
    logger.info(
      `Go Decision: ${stats.failed === 0 ? 'YES' : 'NO (Fix blocking issues)'}`
    )
  } catch (error) {
    logger.error(error, 'Diagnostic failed with error:')
  }
}

async function setupUnhappyGrant(agreements, grants, versionsCol) {
  const agreementNumber = 'WMP_UNHAPPY'
  const existingGrant = await grants.findOne({ agreementNumber })
  if (existingGrant) {
    await versionsCol.deleteMany({ grant: existingGrant._id })
    await grants.deleteOne({ _id: existingGrant._id })
    await agreements.deleteMany({ agreementNumber })
  }

  const agreementId = new ObjectId()
  const grantId = new ObjectId()

  await agreements.insertOne({
    _id: agreementId,
    agreementNumber,
    clientRef: 'wmp-unhappy-ref',
    sbi: '123456789',
    grants: [grantId],
    createdAt: new Date()
  })

  await grants.insertOne({
    _id: grantId,
    code: SCHEME_WOODLAND,
    name: 'WMP Unhappy Path',
    agreementNumber,
    clientRef: 'wmp-unhappy-ref',
    versions: []
  })

  return { agreementNumber, grantId }
}

function getUnhappyVersions(grantId) {
  return [
    ...getBasicUnhappyVersions(grantId),
    ...getComplexUnhappyVersions(grantId)
  ]
}

function getBasicUnhappyVersions(grantId) {
  return [
    {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-001',
      clientRef: 'wmp-missing-sbi',
      code: SCHEME_WOODLAND,
      status: 'accepted',
      grant: grantId,
      identifiers: { sbi: null },
      createdAt: new Date('2026-01-01')
    },
    {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-003',
      clientRef: 'wmp-sequence-error',
      code: SCHEME_WOODLAND,
      status: 'accepted',
      grant: grantId,
      identifiers: { sbi: '106841262' },
      createdAt: new Date('2026-01-05')
    },
    {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-004',
      clientRef: 'wmp-sequence-error',
      code: SCHEME_WOODLAND,
      status: 'accepted',
      grant: grantId,
      identifiers: { sbi: '106841262' },
      createdAt: new Date('2026-01-04')
    },
    {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-006',
      clientRef: 'wmp-pdf-missing',
      code: SCHEME_WOODLAND,
      status: 'accepted',
      grant: grantId,
      identifiers: { sbi: '106841262' },
      documents: {
        agreement_final: { path: 's3://non-existent/final.pdf' }
      },
      createdAt: new Date('2026-01-07')
    }
  ]
}

function getComplexUnhappyVersions(grantId) {
  return [
    {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-002',
      clientRef: 'wmp-total-mismatch',
      code: SCHEME_WOODLAND,
      status: 'accepted',
      grant: grantId,
      identifiers: { sbi: '106841262' },
      payment: { agreementTotalPence: 200000 },
      application: {
        parcel: [
          {
            parcelId: 'ST1234-5678',
            actions: [
              {
                code: 'PA3',
                appliedFor: { quantity: Decimal128.fromString('10') }
              }
            ]
          }
        ]
      },
      createdAt: new Date('2026-01-02')
    },
    {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-005',
      clientRef: 'wmp-bad-parcel',
      code: SCHEME_WOODLAND,
      status: 'accepted',
      grant: grantId,
      identifiers: { sbi: '106841262' },
      application: {
        parcel: [
          {
            parcelId: 'INVALID_PARCEL_FORMAT',
            actions: [{ code: 'PA3' }]
          }
        ]
      },
      createdAt: new Date('2026-01-06')
    }
  ]
}

async function injectUnhappyData() {
  try {
    if (
      mongoose.connection.readyState !== mongoose.ConnectionStates.connected
    ) {
      logger.info(`Connecting to database for injection: ${DB_NAME}`)
      await mongoose.connect(MONGO_URI, { dbName: DB_NAME })
      logger.info('Connected to database.')
    }

    const agreements = mongoose.connection.collection('agreements')
    const grants = mongoose.connection.collection('grants')
    const versionsCol = mongoose.connection.collection('versions')

    const { grantId } = await setupUnhappyGrant(agreements, grants, versionsCol)

    const versions = getUnhappyVersions(grantId)

    await versionsCol.insertMany(versions)
    await grants.updateOne(
      { _id: grantId },
      { $set: { versions: versions.map((v) => v._id) } }
    )

    logger.info('Successfully injected unhappy path data.')
  } catch (error) {
    logger.error('Injection failed:', error)
  }
}

export async function runAgreementDataDiagnosis() {
  if (config.get('featureFlags.wmpMigrationDiagnosis') === true) {
    logger.info(
      'featureFlags.wmpMigrationDiagnosis is enabled. This should not be enabled in production.'
    )

    if (config.get('featureFlags.injectUnHappyWMPData') === true) {
      logger.info(
        'featureFlags.injectUnHappyWMPData is enabled. This should not be enabled in production.'
      )

      await injectUnhappyData()
    }

    try {
      await runWMPAgreementDataDiagnosis()
    } catch (err) {
      logger.error(err, 'Error seeding database failed:')
    }
  }
}
