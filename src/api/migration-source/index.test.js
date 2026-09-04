import { createHash } from 'node:crypto'
import { Types } from 'mongoose'
import { Decimal128, Double, Int32, Long } from 'mongodb'

import { createServer } from '#~/api/index.js'
import agreementsModel from '#~/api/common/models/agreements.js'
import grantModel from '#~/api/common/models/grant.js'
import versionsModel from '#~/api/common/models/versions.js'
import { config } from '#~/config/index.js'

const token = 'migration-source-secret'
const authorization = `Bearer ${token}`
const versionPageSize = 100
const versionCount = 5000
const sourceDate = new Date('2024-01-02T03:04:05.678Z')
const sourceObjectId = new Types.ObjectId()

describe('Migration source routes', () => {
  let server
  let previousTokenHash
  let grantId
  let fpttGrantId
  let fpttVersionId
  let versionIds

  beforeAll(async () => {
    previousTokenHash = config.get('migrationSourceTokenHash')
    config.set(
      'migrationSourceTokenHash',
      createHash('sha256').update(token).digest('hex')
    )

    server = await createServer({ disableSQS: true })
    await server.initialize()

    grantId = new Types.ObjectId()
    fpttGrantId = new Types.ObjectId()
    fpttVersionId = new Types.ObjectId()
    versionIds = Array.from(
      { length: versionCount },
      () => new Types.ObjectId()
    )

    await agreementsModel.collection.insertMany([
      {
        agreementNumber: 'WMP0002',
        clientRef: 'client-2',
        sbi: '100000002',
        grants: [grantId],
        sourceAgreementDouble: new Double(42)
      },
      {
        agreementNumber: 'WMP0001',
        clientRef: 'client-1',
        sbi: '100000001',
        grants: []
      },
      {
        agreementNumber: 'FPTT0001',
        clientRef: 'client-3',
        sbi: '100000003',
        grants: [fpttGrantId]
      }
    ])
    await grantModel.collection.insertMany([
      {
        _id: grantId,
        code: 'woodland',
        name: 'WMP',
        agreementNumber: 'WMP0002',
        clientRef: 'client-2',
        sbi: '100000002',
        versions: versionIds,
        sourceGrantLong: Long.fromNumber(42)
      },
      {
        _id: fpttGrantId,
        code: 'frps-private-beta',
        name: 'FPTT',
        agreementNumber: 'FPTT0001',
        clientRef: 'client-3',
        sbi: '100000003',
        versions: [fpttVersionId]
      }
    ])
    await versionsModel.collection.insertMany([
      ...versionIds.map((_id, index) => ({
        _id,
        grant: grantId,
        notificationMessageId: `message-${index}`,
        marker: index,
        ...(index === 4900
          ? {
              displayedQuantity: Decimal128.fromString('4.757500000000000001'),
              sourceInt32: new Int32(42),
              sourceDouble: new Double(42),
              sourceLong: Long.fromNumber(42),
              sourceLargeLong: Long.fromString('9007199254740993'),
              sourceDate,
              sourceObjectId
            }
          : {})
      })),
      {
        _id: fpttVersionId,
        grant: fpttGrantId,
        notificationMessageId: 'fptt-message',
        marker: 0
      }
    ])
  })

  afterAll(async () => {
    await Promise.all([
      agreementsModel.deleteMany({}),
      grantModel.deleteMany({}),
      versionsModel.deleteMany({})
    ])
    config.set('migrationSourceTokenHash', previousTokenHash)
    await server.stop({ timeout: 0 })
  })

  it.each([
    ['woodland', ['WMP0002']],
    ['frps-private-beta', ['FPTT0001']],
    ['unknown', []]
  ])(
    'lists agreement numbers for grant code %s in stable order',
    async (code, agreementNumbers) => {
      const response = await server.inject({
        method: 'GET',
        url: `/internal/migrations/agreements?code=${code}`,
        headers: { authorization }
      })

      expect(response.statusCode).toBe(200)
      expect(response.result).toEqual({ agreementNumbers })
    }
  )

  it('rejects multi-grant agreements when listing by code', async () => {
    await agreementsModel.collection.updateOne(
      { agreementNumber: 'WMP0002' },
      { $set: { grants: [grantId, fpttGrantId] } }
    )

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/internal/migrations/agreements?code=woodland',
        headers: { authorization }
      })

      expect(response.statusCode).toBe(409)
    } finally {
      await agreementsModel.collection.updateOne(
        { agreementNumber: 'WMP0002' },
        { $set: { grants: [grantId] } }
      )
    }
  })

  it('rejects an unlinked grant when listing by code', async () => {
    const unlinkedGrantId = new Types.ObjectId()
    await grantModel.collection.insertOne({
      _id: unlinkedGrantId,
      code: 'woodland',
      name: 'WMP',
      agreementNumber: 'WMP0001',
      clientRef: 'client-1',
      sbi: '100000001',
      versions: []
    })

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/internal/migrations/agreements?code=woodland',
        headers: { authorization }
      })

      expect(response.statusCode).toBe(409)
    } finally {
      await grantModel.collection.deleteOne({ _id: unlinkedGrantId })
    }
  })

  it('requires a grant code when listing agreements', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/internal/migrations/agreements',
      headers: { authorization }
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns a bounded page in the order declared by Grant.versions', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/internal/migrations/agreements/WMP0002/versions?offset=4900',
      headers: { authorization }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result.agreement).not.toHaveProperty('grants')
    expect(response.result.agreement.sourceAgreementDouble).toEqual({
      $numberDouble: '42.0'
    })
    expect(response.result.grant).not.toHaveProperty('versions')
    expect(response.result.grant.sourceGrantLong).toEqual({
      $numberLong: '42'
    })
    expect(response.result.versions).toHaveLength(versionPageSize)
    expect(
      response.result.versions.map(({ marker }) => Number(marker.$numberInt))
    ).toEqual(
      Array.from({ length: versionPageSize }, (_, index) => 4900 + index)
    )
    expect(response.result.versions[0].displayedQuantity).toEqual({
      $numberDecimal: '4.757500000000000001'
    })
    expect(response.result.versions[0].sourceInt32).toEqual({
      $numberInt: '42'
    })
    expect(response.result.versions[0].sourceDouble).toEqual({
      $numberDouble: '42.0'
    })
    expect(response.result.versions[0].sourceLong).toEqual({
      $numberLong: '42'
    })
    expect(response.result.versions[0].sourceLargeLong).toEqual({
      $numberLong: '9007199254740993'
    })
    expect(response.result.versions[0].sourceDate).toEqual({
      $date: { $numberLong: String(sourceDate.getTime()) }
    })
    expect(response.result.versions[0].sourceObjectId).toEqual({
      $oid: sourceObjectId.toHexString()
    })
    expect(response.result.nextOffset).toBeNull()
  })

  it('returns the next offset when more versions exist', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/internal/migrations/agreements/WMP0002/versions',
      headers: { authorization }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result.versions).toHaveLength(versionPageSize)
    expect(response.result.nextOffset).toBe(versionPageSize)
  })

  it('returns versions for an agreement regardless of its prefix', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/internal/migrations/agreements/FPTT0001/versions',
      headers: { authorization }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result.grant.code).toBe('frps-private-beta')
    expect(response.result.versions).toHaveLength(1)
    expect(response.result.nextOffset).toBeNull()
  })

  it.each([
    ['an unknown agreement', 'WMP9999'],
    ['an agreement without a grant', 'WMP0001']
  ])('rejects %s', async (_scenario, agreementNumber) => {
    const response = await server.inject({
      method: 'GET',
      url: `/internal/migrations/agreements/${agreementNumber}/versions`,
      headers: { authorization }
    })

    expect(response.statusCode).toBe(404)
  })

  it('rejects incomplete version history', async () => {
    const missingVersionId = versionIds[0]
    await versionsModel.collection.deleteOne({ _id: missingVersionId })

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/internal/migrations/agreements/WMP0002/versions',
        headers: { authorization }
      })

      expect(response.statusCode).toBe(409)
    } finally {
      await versionsModel.collection.insertOne({
        _id: missingVersionId,
        grant: grantId,
        notificationMessageId: 'message-0',
        marker: 0
      })
    }
  })

  it('rejects a version omitted from Grant.versions', async () => {
    const unindexedVersionId = new Types.ObjectId()
    await versionsModel.collection.insertOne({
      _id: unindexedVersionId,
      grant: grantId,
      notificationMessageId: 'unindexed-message'
    })

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/internal/migrations/agreements/WMP0002/versions',
        headers: { authorization }
      })

      expect(response.statusCode).toBe(409)
    } finally {
      await versionsModel.collection.deleteOne({ _id: unindexedVersionId })
    }
  })

  it('rejects duplicate entries in Grant.versions', async () => {
    await grantModel.collection.updateOne(
      { _id: grantId },
      { $set: { versions: [...versionIds, versionIds[0]] } }
    )

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/internal/migrations/agreements/WMP0002/versions',
        headers: { authorization }
      })

      expect(response.statusCode).toBe(409)
    } finally {
      await grantModel.collection.updateOne(
        { _id: grantId },
        { $set: { versions: versionIds } }
      )
    }
  })

  it('rejects an unlinked grant with the same agreement number', async () => {
    const agreementId = new Types.ObjectId()
    const unlinkedGrantId = new Types.ObjectId()
    await agreementsModel.collection.insertOne({
      _id: agreementId,
      agreementNumber: 'WMP0003',
      clientRef: 'client-3',
      sbi: '100000003',
      grants: []
    })
    await grantModel.collection.insertOne({
      _id: unlinkedGrantId,
      agreementNumber: 'WMP0003',
      versions: []
    })

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/internal/migrations/agreements/WMP0003/versions',
        headers: { authorization }
      })

      expect(response.statusCode).toBe(409)
    } finally {
      await Promise.all([
        agreementsModel.collection.deleteOne({ _id: agreementId }),
        grantModel.collection.deleteOne({ _id: unlinkedGrantId })
      ])
    }
  })

  it('rejects multiple grants with the same agreement number', async () => {
    const agreementId = new Types.ObjectId()
    const matchingGrantIds = [new Types.ObjectId(), new Types.ObjectId()]
    await agreementsModel.collection.insertOne({
      _id: agreementId,
      agreementNumber: 'WMP0004',
      clientRef: 'client-4',
      sbi: '100000004',
      grants: matchingGrantIds
    })
    await grantModel.collection.insertMany(
      matchingGrantIds.map((_id, index) => ({
        _id,
        agreementNumber: 'WMP0004',
        code: `woodland-${index}`,
        versions: []
      }))
    )

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/internal/migrations/agreements/WMP0004/versions',
        headers: { authorization }
      })

      expect(response.statusCode).toBe(409)
    } finally {
      await Promise.all([
        agreementsModel.collection.deleteOne({ _id: agreementId }),
        grantModel.collection.deleteMany({ _id: { $in: matchingGrantIds } })
      ])
    }
  })

  it('rejects duplicate entries in Agreement.grants', async () => {
    await agreementsModel.collection.updateOne(
      { agreementNumber: 'WMP0002' },
      { $set: { grants: [grantId, grantId] } }
    )

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/internal/migrations/agreements/WMP0002/versions',
        headers: { authorization }
      })

      expect(response.statusCode).toBe(409)
    } finally {
      await agreementsModel.collection.updateOne(
        { agreementNumber: 'WMP0002' },
        { $set: { grants: [grantId] } }
      )
    }
  })

  it('rejects a dangling grant referenced by Agreement.grants', async () => {
    await agreementsModel.collection.updateOne(
      { agreementNumber: 'WMP0002' },
      { $set: { grants: [grantId, new Types.ObjectId()] } }
    )

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/internal/migrations/agreements/WMP0002/versions',
        headers: { authorization }
      })

      expect(response.statusCode).toBe(409)
    } finally {
      await agreementsModel.collection.updateOne(
        { agreementNumber: 'WMP0002' },
        { $set: { grants: [grantId] } }
      )
    }
  })

  it('rejects a linked grant with a different agreement number', async () => {
    const agreementId = new Types.ObjectId()
    const linkedGrantId = new Types.ObjectId()
    await agreementsModel.collection.insertOne({
      _id: agreementId,
      agreementNumber: 'WMP0005',
      clientRef: 'client-5',
      sbi: '100000005',
      grants: [linkedGrantId]
    })
    await grantModel.collection.insertOne({
      _id: linkedGrantId,
      agreementNumber: 'WMP9998',
      versions: []
    })

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/internal/migrations/agreements/WMP0005/versions',
        headers: { authorization }
      })

      expect(response.statusCode).toBe(409)
    } finally {
      await Promise.all([
        agreementsModel.collection.deleteOne({ _id: agreementId }),
        grantModel.collection.deleteOne({ _id: linkedGrantId })
      ])
    }
  })

  it('requires the migration token', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/internal/migrations/agreements?code=woodland'
    })

    expect(response.statusCode).toBe(401)
  })
})
