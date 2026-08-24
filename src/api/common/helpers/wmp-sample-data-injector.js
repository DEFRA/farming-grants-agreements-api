import mongoose from 'mongoose'
import { Decimal128, ObjectId } from 'mongodb'

import { createLogger } from '#~/api/common/helpers/logging/logger.js'
import { config } from '#~/config/index.js'

const logger = createLogger()

const MONGO_URI = config.get('mongoUri')
const DB_NAME = config.get('mongoDatabase')
const SCHEME_WOODLAND = 'woodland'
const SAMPLE_CLIENT_REF = 'wmp-kx2-yjf'
const SAMPLE_PARCEL_ID = 'ST1437-7349'

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

function createBaseVersion(grantId, overrides = {}) {
  return {
    code: SCHEME_WOODLAND,
    identifiers: { sbi: '106841262', frn: '106841262', crn: '1101092483' },
    status: 'accepted',
    grant: grantId,
    scheme: 'WMP',
    ...overrides
  }
}

function getBasicUnhappyVersions(grantId) {
  return [
    createBaseVersion(grantId, {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-001',
      clientRef: 'wmp-missing-sbi',
      identifiers: { sbi: null },
      createdAt: new Date('2026-01-01')
    }),
    createBaseVersion(grantId, {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-003',
      clientRef: 'wmp-sequence-error',
      createdAt: new Date('2026-01-05')
    }),
    createBaseVersion(grantId, {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-004',
      clientRef: 'wmp-sequence-error',
      createdAt: new Date('2026-01-04')
    }),
    createBaseVersion(grantId, {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-006',
      clientRef: 'wmp-pdf-missing',
      documents: {
        agreement_final: { path: 's3://non-existent/final.pdf' }
      },
      createdAt: new Date('2026-01-07')
    })
  ]
}

function getComplexUnhappyVersions(grantId) {
  return [
    createBaseVersion(grantId, {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-002',
      clientRef: 'wmp-total-mismatch',
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
    }),
    createBaseVersion(grantId, {
      _id: new ObjectId(),
      notificationMessageId: 'unhappy-msg-005',
      clientRef: 'wmp-bad-parcel',
      application: {
        parcel: [
          {
            parcelId: 'INVALID_PARCEL_FORMAT',
            actions: [{ code: 'PA3' }]
          }
        ]
      },
      createdAt: new Date('2026-01-06')
    })
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
    agreementNumber: 'WMP511921015',
    clientRef: SAMPLE_CLIENT_REF,
    sbi: '106841262',
    frn: '106841262',
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
    agreementNumber: 'WMP511921015',
    clientRef: SAMPLE_CLIENT_REF,
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
  }
}

function getVersion1Payment() {
  return {
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
  }
}

function getVersion1Applicant() {
  return {
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
  }
}

function getVersion1Application() {
  return {
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
  }
}

function getVersion1(grantId) {
  return createBaseVersion(grantId, {
    _id: new ObjectId('6a588c08ca29f920440b672e'),
    notificationMessageId: '7ecc123b-e4a3-4308-b608-b2ebdb042759',
    agreementName: "Bil's woods WMP",
    correlationId: '71cf3bf0-0adf-4e9a-bc3d-84ab3e0e342d',
    clientRef: SAMPLE_CLIENT_REF,
    payment: getVersion1Payment(),
    applicant: getVersion1Applicant(),
    application: getVersion1Application(),
    createdAt: new Date('2026-07-16T07:45:12.618Z'),
    updatedAt: new Date('2026-07-16T07:45:45.964Z')
  })
}

function getCommonPayment() {
  return {
    agreementTotalPence: 150000,
    annualTotalPence: 150000,
    frequency: 'OneOff'
  }
}

function getCommonParcel(quantity) {
  return {
    parcelId: SAMPLE_PARCEL_ID,
    actions: [
      {
        code: 'PA3',
        appliedFor: { quantity: Decimal128.fromString(quantity) }
      }
    ]
  }
}

function getVersion2(grantId) {
  return createBaseVersion(grantId, {
    _id: new ObjectId('6a58aeb0ca29f920440b6774'),
    notificationMessageId: 'unique-msg-id-002',
    agreementName: "Bil's woods WMP",
    correlationId: '71cf3bf0-0adf-4e9a-bc3d-84ab3e0e342d',
    clientRef: 'wmp-pun-yp3',
    payment: getCommonPayment(),
    applicant: {
      business: { name: 'MORTIMER AND Co.' },
      customer: { name: { first: 'Bernardine', last: "O'toole" } }
    },
    application: {
      parcel: [
        getCommonParcel('17'),
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
  })
}

function getVersion3(grantId) {
  return createBaseVersion(grantId, {
    _id: new ObjectId('6a5f7d5567f11d6ed48db40e'),
    notificationMessageId: 'unique-msg-id-003',
    clientRef: 'wmp-fjx-4lf',
    status: 'offered',
    payment: { agreementTotalPence: 150000, frequency: 'OneOff' },
    application: {
      parcel: [getCommonParcel('11')]
    },
    createdAt: new Date('2026-07-21T14:08:21.747Z'),
    updatedAt: new Date('2026-07-21T14:08:21.747Z')
  })
}

function getVersion4(grantId) {
  return createBaseVersion(grantId, {
    _id: new ObjectId('6a637952de6d93b63dbefd46'),
    notificationMessageId: 'unique-msg-id-004',
    clientRef: 'wmp-ytl-e5u',
    payment: { agreementTotalPence: 150000, frequency: 'OneOff' },
    application: {
      parcel: [getCommonParcel('19')]
    },
    createdAt: new Date('2026-07-24T14:40:18.802Z'),
    updatedAt: new Date('2026-07-24T14:41:30.153Z')
  })
}

function getVersion5(grantId) {
  return createBaseVersion(grantId, {
    _id: new ObjectId('6a71cbeb700e6d5f9fbad436'),
    notificationMessageId: 'unique-msg-id-005',
    clientRef: 'a4l-vjl-4j8',
    code: 'frps-private-beta',
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
  })
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

    const agreementId = new ObjectId('6a1991f712df5413e7e6f706')
    const grantId = new ObjectId('6a1991f712df5413e7e6f709')

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
