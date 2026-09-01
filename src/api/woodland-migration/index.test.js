import { createHash } from 'node:crypto'
import { Types } from 'mongoose'
import { Decimal128 } from 'mongodb'

import { createServer } from '#~/api/index.js'
import agreementsModel from '#~/api/common/models/agreements.js'
import grantModel from '#~/api/common/models/grant.js'
import versionsModel from '#~/api/common/models/versions.js'
import { config } from '#~/config/index.js'

const token = 'woodland-migration-secret'
const authorization = `Bearer ${token}`
const versionPageSize = 100
const versionCount = 5000

describe('Woodland migration source routes', () => {
  let server
  let previousTokenHash
  let grantId
  let versionIds

  beforeAll(async () => {
    previousTokenHash = config.get('woodlandMigrationTokenHash')
    config.set(
      'woodlandMigrationTokenHash',
      createHash('sha256').update(token).digest('hex')
    )

    server = await createServer({ disableSQS: true })
    await server.initialize()

    grantId = new Types.ObjectId()
    versionIds = Array.from(
      { length: versionCount },
      () => new Types.ObjectId()
    )

    await agreementsModel.collection.insertMany([
      {
        agreementNumber: 'WMP0002',
        clientRef: 'client-2',
        sbi: '100000002',
        grants: [grantId]
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
        grants: []
      }
    ])
    await grantModel.collection.insertOne({
      _id: grantId,
      code: 'woodland',
      name: 'WMP',
      agreementNumber: 'WMP0002',
      clientRef: 'client-2',
      sbi: '100000002',
      versions: versionIds
    })
    await versionsModel.collection.insertMany(
      versionIds.map((_id, index) => ({
        _id,
        grant: grantId,
        notificationMessageId: `message-${index}`,
        marker: index,
        ...(index === 4900
          ? { displayedQuantity: Decimal128.fromString('4.757500000000000001') }
          : {})
      }))
    )
  })

  afterAll(async () => {
    await Promise.all([
      agreementsModel.deleteMany({}),
      grantModel.deleteMany({}),
      versionsModel.deleteMany({})
    ])
    config.set('woodlandMigrationTokenHash', previousTokenHash)
    await server.stop({ timeout: 0 })
  })

  it('lists every Woodland agreement number in stable order', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/internal/migrations/woodland/agreements',
      headers: { authorization }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({
      agreementNumbers: ['WMP0001', 'WMP0002']
    })
  })

  it('returns a bounded page in the order declared by Grant.versions', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/internal/migrations/woodland/agreements/WMP0002/versions?offset=4900',
      headers: { authorization }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result.agreement).not.toHaveProperty('grants')
    expect(response.result.grant).not.toHaveProperty('versions')
    expect(response.result.versions).toHaveLength(versionPageSize)
    expect(response.result.versions.map(({ marker }) => marker)).toEqual(
      Array.from({ length: versionPageSize }, (_, index) => 4900 + index)
    )
    expect(response.result.versions[0].displayedQuantity).toEqual({
      $numberDecimal: '4.757500000000000001'
    })
    expect(response.result.nextOffset).toBeNull()
  })

  it('returns the next offset when more versions exist', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/internal/migrations/woodland/agreements/WMP0002/versions',
      headers: { authorization }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result.versions).toHaveLength(versionPageSize)
    expect(response.result.nextOffset).toBe(versionPageSize)
  })

  it('requires the migration token', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/internal/migrations/woodland/agreements'
    })

    expect(response.statusCode).toBe(401)
  })
})
