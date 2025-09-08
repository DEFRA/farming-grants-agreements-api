import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { config } from '~/src/config/index.js'

jest.mock('~/src/api/common/helpers/sqs-client.js')
jest.mock('~/src/api/common/helpers/jwt-auth.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  __esModule: true,
  ...jest.requireActual('~/src/api/agreement/helpers/get-agreement-data.js'),
  getAgreementDataById: jest.fn()
}))

const s3Mock = mockClient(S3Client)

describe('GET /{agreementId}/{version}/download', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  beforeAll(async () => {
    server = await createServer({ disableSQS: true })
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    s3Mock.reset()

    config.set('files.s3.bucket', 'test-bucket')

    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(true)

    jest.spyOn(agreementDataHelper, 'getAgreementDataById').mockResolvedValue({
      agreementNumber: 'AGR-123',
      sbi: '123456789',
      status: 'offered'
    })
  })

  test('200 streams pdf with headers', async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('%PDF-1.4\n') })

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download'
    })

    expect(res.statusCode).toBe(statusCodes.ok)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toContain('AGR-123-1.pdf')
    expect(res.rawPayload?.length ?? res.payload?.length ?? 0).toBeGreaterThan(
      0
    )
  })

  test('404 when S3 object missing', async () => {
    s3Mock.on(GetObjectCommand).rejects({ name: 'NoSuchKey' })

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download'
    })

    expect(res.statusCode).toBe(statusCodes.notFound)
  })

  test('503 when bucket not configured', async () => {
    config.set('files.s3.bucket', '')

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download'
    })

    expect(res.statusCode).toBe(statusCodes.serviceUnavailable)
  })

  test('500 when S3 returns unexpected error', async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error('S3 throttling'))

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download'
    })

    expect(res.statusCode).toBe(statusCodes.internalServerError)
    // Check that we get a proper error response structure
    expect(res.result).toBeDefined()
  })
})
