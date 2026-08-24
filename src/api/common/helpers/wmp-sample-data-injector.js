import mongoose from 'mongoose'
import { Decimal128, ObjectId } from 'mongodb'

import { createLogger } from '#~/api/common/helpers/logging/logger.js'
import { config } from '#~/config/index.js'

const logger = createLogger()

const MONGO_URI = config.get('mongoUri')
const DB_NAME = config.get('mongoDatabase')
const SCHEME_WOODLAND = 'woodland'
const SAMPLE_CLIENT_REF = 'wmp-example-301'
const SAMPLE_PARCEL_ID = 'AA0301-0301'

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
      identifiers: { sbi: '900000301' },
      createdAt: new Date('2026-01-05')
    },
    {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-004',
      clientRef: 'wmp-sequence-error',
      code: SCHEME_WOODLAND,
      status: 'accepted',
      grant: grantId,
      identifiers: { sbi: '900000301' },
      createdAt: new Date('2026-01-04')
    },
    {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-006',
      clientRef: 'wmp-pdf-missing',
      code: SCHEME_WOODLAND,
      status: 'accepted',
      grant: grantId,
      identifiers: { sbi: '900000301' },
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
      identifiers: { sbi: '900000301' },
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
      identifiers: { sbi: '900000301' },
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

function getUnhappyVersions(grantId) {
  return [
    ...getBasicUnhappyVersions(grantId),
    ...getComplexUnhappyVersions(grantId)
  ]
}

async function ensureConnected() {
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected) {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME })
  }
}

async function cleanData(
  agreements,
  grants,
  versionsCol,
  agreementId,
  grantId
) {
  await versionsCol.deleteMany({ grant: grantId })
  await grants.deleteMany({ _id: grantId })
  await agreements.deleteMany({ _id: agreementId })
}

function getHappyPathAgreement(agreementId, grantId) {
  return {
    _id: agreementId,
    agreementNumber: 'WMP900000301',
    clientRef: SAMPLE_CLIENT_REF,
    sbi: '900000301',
    frn: '900000301',
    grants: [grantId],
    createdAt: new Date('2026-05-29T13:17:43.726Z'),
    updatedAt: new Date('2026-05-29T13:17:43.742Z'),
    __v: 0
  }
}

function getHappyPathGrant(grantId) {
  return {
    _id: grantId,
    code: SCHEME_WOODLAND,
    name: 'WMP',
    agreementNumber: 'WMP900000301',
    clientRef: SAMPLE_CLIENT_REF,
    sbi: '900000301',
    frn: '900000301',
    versions: [
      new ObjectId('f000000000000000000003eb'),
      new ObjectId('f000000000000000000003ec'),
      new ObjectId('f000000000000000000003ed'),
      new ObjectId('f000000000000000000003ee'),
      new ObjectId('f000000000000000000003ef')
    ],
    createdAt: new Date('2026-05-29T13:17:43.737Z'),
    updatedAt: new Date('2026-08-04T11:24:27.592Z'),
    __v: 0
  }
}

function getVersion1(grantId) {
  return {
    _id: new ObjectId('f000000000000000000003eb'),
    notificationMessageId: '00000000-0000-4000-8000-000000001001',
    agreementName: "Bil's woods WMP",
    correlationId: '00000000-0000-4000-8000-000000001000',
    clientRef: SAMPLE_CLIENT_REF,
    code: SCHEME_WOODLAND,
    identifiers: { sbi: '900000301', frn: '900000301', crn: '9100000301' },
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
        name: 'Example Woodland Business Ltd',
        address: {
          line1: '6 Example Lane',
          city: 'Exampleton',
          postalCode: 'ZZ99 1ZZ'
        }
      },
      customer: {
        name: { title: 'Mrs', first: 'Robin', last: "Example" }
      }
    },
    application: {
      parcel: [
        {
          parcelId: SAMPLE_PARCEL_ID,
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
          parcelId: 'AA0302-0302',
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
  }
}

function getVersion2(grantId) {
  return {
    _id: new ObjectId('f000000000000000000003ec'),
    notificationMessageId: 'unique-msg-id-002',
    agreementName: "Bil's woods WMP",
    correlationId: '00000000-0000-4000-8000-000000001000',
    clientRef: 'wmp-example-304',
    code: SCHEME_WOODLAND,
    identifiers: { sbi: '900000301', frn: '900000301', crn: '9100000301' },
    status: 'accepted',
    grant: grantId,
    scheme: 'WMP',
    payment: {
      agreementTotalPence: 150000,
      annualTotalPence: 150000,
      frequency: 'OneOff'
    },
    applicant: {
      business: { name: 'Example Woodland Business Ltd' },
      customer: { name: { first: 'Robin', last: "Example" } }
    },
    application: {
      parcel: [
        {
          parcelId: SAMPLE_PARCEL_ID,
          actions: [
            {
              code: 'PA3',
              appliedFor: { quantity: Decimal128.fromString('17') }
            }
          ]
        },
        {
          parcelId: 'AA0302-0302',
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
  }
}

function getVersion3(grantId) {
  return {
    _id: new ObjectId('f000000000000000000003ed'),
    notificationMessageId: 'unique-msg-id-003',
    clientRef: 'wmp-example-303',
    code: SCHEME_WOODLAND,
    identifiers: { sbi: '900000301', frn: '900000301', crn: '9100000301' },
    status: 'offered',
    grant: grantId,
    scheme: 'WMP',
    payment: { agreementTotalPence: 150000, frequency: 'OneOff' },
    application: {
      parcel: [
        {
          parcelId: SAMPLE_PARCEL_ID,
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
  }
}

function getVersion4(grantId) {
  return {
    _id: new ObjectId('f000000000000000000003ee'),
    notificationMessageId: 'unique-msg-id-004',
    clientRef: 'wmp-example-305',
    code: SCHEME_WOODLAND,
    identifiers: { sbi: '900000301', frn: '900000301', crn: '9100000301' },
    status: 'accepted',
    grant: grantId,
    scheme: 'WMP',
    payment: { agreementTotalPence: 150000, frequency: 'OneOff' },
    application: {
      parcel: [
        {
          parcelId: SAMPLE_PARCEL_ID,
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
  }
}

function getVersion5(grantId) {
  return {
    _id: new ObjectId('f000000000000000000003ef'),
    notificationMessageId: 'unique-msg-id-005',
    clientRef: 'example-app-304',
    code: 'frps-private-beta',
    identifiers: { sbi: '900000301', frn: '900000301', crn: '9100000301' },
    status: 'accepted',
    grant: grantId,
    scheme: 'SFI',
    payment: { agreementTotalPence: 460725, frequency: 'Quarterly' },
    application: {
      parcel: [
        {
          parcelId: '0301',
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
}

function getHappyPathVersions(grantId) {
  return [
    getVersion1(grantId),
    getVersion2(grantId),
    getVersion3(grantId),
    getVersion4(grantId),
    getVersion5(grantId)
  ]
}

export async function injectSampleWMPData() {
  try {
    await ensureConnected()

    const agreements = mongoose.connection.collection('agreements')
    const grants = mongoose.connection.collection('grants')
    const versionsCol = mongoose.connection.collection('versions')

    const agreementId = new ObjectId('f000000000000000000003e9')
    const grantId = new ObjectId('f000000000000000000003ea')

    await cleanData(agreements, grants, versionsCol, agreementId, grantId)

    await agreements.insertOne(getHappyPathAgreement(agreementId, grantId))
    await grants.insertOne(getHappyPathGrant(grantId))
    await versionsCol.insertMany(getHappyPathVersions(grantId))

    // eslint-disable-next-line no-console
    console.log('Successfully injected happy path Woodland data.')
  } catch (error) {
    logger.error('Injection failed:', error)
  }
}

export async function injectUnhappyData() {
  try {
    await ensureConnected()

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
