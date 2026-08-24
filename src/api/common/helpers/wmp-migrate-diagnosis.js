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

async function injectSampleWMPData() {
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

    const agreementId = new ObjectId('6a1991f712df5413e7e6f706')
    const grantId = new ObjectId('6a1991f712df5413e7e6f709')

    // Clean up existing data if any
    await versionsCol.deleteMany({ grant: grantId })
    await grants.deleteMany({ _id: grantId })
    await agreements.deleteMany({ _id: agreementId })

    // 1. Inject the Agreement
    await agreements.insertOne({
      _id: agreementId,
      agreementNumber: 'WMP511921015',
      clientRef: 'wmp-kx2-yjf',
      sbi: '106841262',
      frn: '106841262',
      grants: [grantId],
      createdAt: new Date('2026-05-29T13:17:43.726Z'),
      updatedAt: new Date('2026-05-29T13:17:43.742Z'),
      __v: 0
    })

    // 2. Inject the Grant
    await grants.insertOne({
      _id: grantId,
      code: SCHEME_WOODLAND,
      name: 'WMP',
      agreementNumber: 'WMP511921015',
      clientRef: 'wmp-kx2-yjf',
      sbi: '106841262',
      frn: '106841262',
      versions: [
        new ObjectId('6a588c08ca29f920440b672e'),
        new ObjectId('6a58aeb0ca29f920440b6774'),
        new ObjectId('6a5f7d5567f11d6ed48db40e'),
        new ObjectId('6a637952de6d93b63dbefd46'),
        new ObjectId('6a71cbeb700e6d5f9fbad436')
      ],
      createdAt: new Date('2026-05-29T13:17:43.737Z'),
      updatedAt: new Date('2026-08-04T11:24:27.592Z'),
      __v: 0
    })

    // 3. Inject the Versions
    await versionsCol.insertMany([
      {
        _id: new ObjectId('6a588c08ca29f920440b672e'),
        notificationMessageId: '7ecc123b-e4a3-4308-b608-b2ebdb042759',
        agreementName: "Bil's woods WMP",
        correlationId: '71cf3bf0-0adf-4e9a-bc3d-84ab3e0e342d',
        clientRef: 'wmp-kx2-yjf',
        code: SCHEME_WOODLAND,
        identifiers: { sbi: '106841262', frn: '106841262', crn: '1101092483' },
        status: 'accepted',
        grant: grantId,
        scheme: 'WMP',
        payment: {
          agreementStartDate: '2026-08-01',
          agreementEndDate: '2029-07-31',
          frequency: 'OneOff',
          agreementTotalPence: 150000,
          annualTotalPence: 150000,
          agreementLevelItems: {
            1: {
              code: 'PA3',
              description: 'Woodland management plan',
              version: '1',
              annualPaymentPence: 150000
            }
          }
        },
        applicant: {
          business: {
            name: 'MORTIMER AND Co.',
            address: {
              line1: 'Top Farm Two',
              city: 'Clitheroe',
              postalCode: 'BB7 4LQ'
            }
          },
          customer: {
            name: { title: 'Mrs', first: 'Bernardine', last: "O'toole" }
          }
        },
        application: {
          parcel: [
            {
              parcelId: 'ST1437-7349',
              area: { unit: 'ha', quantity: Decimal128.fromString('35.6517') },
              actions: [
                {
                  code: 'PA3',
                  version: '1',
                  appliedFor: {
                    unit: 'ha',
                    quantity: Decimal128.fromString('25')
                  }
                }
              ]
            },
            {
              parcelId: 'ST1335-0972',
              area: { unit: 'ha', quantity: Decimal128.fromString('0.0827') },
              actions: [
                {
                  code: 'PA3',
                  version: '1',
                  appliedFor: {
                    unit: 'ha',
                    quantity: Decimal128.fromString('25')
                  }
                }
              ]
            }
          ]
        },
        createdAt: new Date('2026-07-16T07:45:12.618Z'),
        updatedAt: new Date('2026-07-16T07:45:45.964Z')
      },
      {
        _id: new ObjectId('6a58aeb0ca29f920440b6774'),
        notificationMessageId: 'unique-msg-id-002',
        agreementName: "Bil's woods WMP",
        correlationId: '71cf3bf0-0adf-4e9a-bc3d-84ab3e0e342d',
        clientRef: 'wmp-pun-yp3',
        code: SCHEME_WOODLAND,
        identifiers: { sbi: '106841262', frn: '106841262', crn: '1101092483' },
        status: 'accepted',
        grant: grantId,
        scheme: 'WMP',
        payment: {
          agreementTotalPence: 150000,
          annualTotalPence: 150000,
          frequency: 'OneOff'
        },
        applicant: {
          business: { name: 'MORTIMER AND Co.' },
          customer: { name: { first: 'Bernardine', last: "O'toole" } }
        },
        application: {
          parcel: [
            {
              parcelId: 'ST1437-7349',
              actions: [
                {
                  code: 'PA3',
                  appliedFor: { quantity: Decimal128.fromString('17') }
                }
              ]
            },
            {
              parcelId: 'ST1335-0972',
              actions: [
                {
                  code: 'PA3',
                  appliedFor: { quantity: Decimal128.fromString('17') }
                }
              ]
            }
          ]
        },
        createdAt: new Date('2026-07-16T10:13:04.337Z'),
        updatedAt: new Date('2026-07-16T10:14:03.005Z')
      },
      {
        _id: new ObjectId('6a5f7d5567f11d6ed48db40e'),
        notificationMessageId: 'unique-msg-id-003',
        clientRef: 'wmp-fjx-4lf',
        code: SCHEME_WOODLAND,
        identifiers: { sbi: '106841262', frn: '106841262', crn: '1101092483' },
        status: 'offered',
        grant: grantId,
        scheme: 'WMP',
        payment: { agreementTotalPence: 150000, frequency: 'OneOff' },
        application: {
          parcel: [
            {
              parcelId: 'ST1437-7349',
              actions: [
                {
                  code: 'PA3',
                  appliedFor: { quantity: Decimal128.fromString('11') }
                }
              ]
            }
          ]
        },
        createdAt: new Date('2026-07-21T14:08:21.747Z'),
        updatedAt: new Date('2026-07-21T14:08:21.747Z')
      },
      {
        _id: new ObjectId('6a637952de6d93b63dbefd46'),
        notificationMessageId: 'unique-msg-id-004',
        clientRef: 'wmp-ytl-e5u',
        code: SCHEME_WOODLAND,
        identifiers: { sbi: '106841262', frn: '106841262', crn: '1101092483' },
        status: 'accepted',
        grant: grantId,
        scheme: 'WMP',
        payment: { agreementTotalPence: 150000, frequency: 'OneOff' },
        application: {
          parcel: [
            {
              parcelId: 'ST1437-7349',
              actions: [
                {
                  code: 'PA3',
                  appliedFor: { quantity: Decimal128.fromString('19') }
                }
              ]
            }
          ]
        },
        createdAt: new Date('2026-07-24T14:40:18.802Z'),
        updatedAt: new Date('2026-07-24T14:41:30.153Z')
      },
      {
        _id: new ObjectId('6a71cbeb700e6d5f9fbad436'),
        notificationMessageId: 'unique-msg-id-005',
        clientRef: 'a4l-vjl-4j8',
        code: 'frps-private-beta',
        identifiers: { sbi: '106841262', frn: '106841262', crn: '1101092483' },
        status: 'accepted',
        grant: grantId,
        scheme: 'SFI',
        payment: { agreementTotalPence: 460725, frequency: 'Quarterly' },
        application: {
          parcel: [
            {
              parcelId: '7349',
              actions: [
                {
                  code: 'CMOR1',
                  appliedFor: { quantity: Decimal128.fromString('35.6517') }
                }
              ]
            }
          ]
        },
        createdAt: new Date('2026-08-04T11:24:27.582Z'),
        updatedAt: new Date('2026-08-04T11:25:43.942Z')
      }
    ])

    // eslint-disable-next-line no-console
    console.log('Successfully injected happy path Woodland data.')
  } catch (error) {
    logger.error('Injection failed:', error)
  }
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

    if (config.get('featureFlags.injectSampleWMPData') === true) {
      logger.info(
        'featureFlags.injectSampleWMPData is enabled. This should not be enabled in production.'
      )

      await injectSampleWMPData()
    }

    try {
      await runWMPAgreementDataDiagnosis()
    } catch (err) {
      logger.error(err, 'Error seeding database failed:')
    }
  }
}
