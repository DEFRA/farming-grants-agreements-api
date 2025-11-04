import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'
import * as agreementDataHelper from '~/src/api/agreement/helpers/get-agreement-data.js'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { config } from '~/src/config/index.js'
import { addYears } from 'date-fns'

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
    config.set('files.s3.shortTermPrefix', 'agreements_10')
    config.set('files.s3.mediumTermPrefix', 'agreements_15')
    config.set('files.s3.longTermPrefix', 'agreements_20')

    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
      valid: true,
      source: 'defra',
      sbi: '106284736'
    })

    jest.spyOn(agreementDataHelper, 'getAgreementDataById').mockResolvedValue({
      agreementNumber: 'AGR-123',
      sbi: '123456789',
      status: 'offered',
      answers: {
        payment: {
          agreementEndDate: addYears(new Date(), 3).toISOString()
        }
      }
    })
  })

  test('200 streams pdf with headers', async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('%PDF-1.4\n') })

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download',
      headers: {
        'x-encrypted-auth': 'mock-jwt-token'
      }
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
      url: '/AGR-123/1/download',
      headers: {
        'x-encrypted-auth': 'mock-jwt-token'
      }
    })

    expect(res.statusCode).toBe(statusCodes.notFound)
  })

  test('503 when bucket not configured', async () => {
    config.set('files.s3.bucket', '')

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download',
      headers: {
        'x-encrypted-auth': 'mock-jwt-token'
      }
    })

    expect(res.statusCode).toBe(statusCodes.serviceUnavailable)
  })

  test('500 when S3 returns unexpected error', async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error('S3 throttling'))

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download',
      headers: {
        'x-encrypted-auth': 'mock-jwt-token'
      }
    })

    expect(res.statusCode).toBe(statusCodes.internalServerError)
    expect(res.result).toBeDefined()
  })

  test('401 when no agreement data in credentials', async () => {
    jest
      .spyOn(agreementDataHelper, 'getAgreementDataById')
      .mockResolvedValue(null)
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue(false)

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download',
      headers: {
        'x-encrypted-auth': 'mock-jwt-token'
      }
    })

    expect(res.statusCode).toBe(statusCodes.unauthorized)
    expect(res.result).toBeDefined()
    expect(res.result.errorMessage).toContain('Not authorized')
  })

  test('security: uses agreementId from authenticated credentials, not URL parameter', async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('%PDF-1.4\n') })
    jest.spyOn(agreementDataHelper, 'getAgreementDataById').mockResolvedValue({
      agreementNumber: 'AGR-999',
      sbi: '123456789',
      status: 'offered',
      answers: {
        payment: {
          agreementEndDate: addYears(new Date(), 3).toISOString()
        }
      }
    })

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download',
      headers: {
        'x-encrypted-auth': 'mock-jwt-token'
      }
    })

    expect(res.statusCode).toBe(statusCodes.ok)
    expect(res.headers['content-disposition']).toContain('AGR-999-1.pdf')
  })

  test('uses retention period 10 for agreement ending in 3 years', async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('%PDF-1.4\n') })
    jest.spyOn(agreementDataHelper, 'getAgreementDataById').mockResolvedValue({
      agreementNumber: 'AGR-123',
      sbi: '123456789',
      status: 'offered',
      answers: {
        payment: {
          agreementEndDate: addYears(new Date(), 3).toISOString()
        }
      }
    })

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download',
      headers: {
        'x-encrypted-auth': 'mock-jwt-token'
      }
    })

    expect(res.statusCode).toBe(statusCodes.ok)
    // Verify S3 was called with the correct key including retention period
    const s3Calls = s3Mock.commandCalls(GetObjectCommand)
    expect(s3Calls[0].args[0].input.Key).toContain('agreements_10/')
  })

  test('uses retention period 15 for agreement ending in 5 years', async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('%PDF-1.4\n') })
    jest.spyOn(agreementDataHelper, 'getAgreementDataById').mockResolvedValue({
      agreementNumber: 'AGR-123',
      sbi: '123456789',
      status: 'offered',
      answers: {
        payment: {
          agreementEndDate: addYears(new Date(), 5).toISOString()
        }
      }
    })

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download',
      headers: {
        'x-encrypted-auth': 'mock-jwt-token'
      }
    })

    expect(res.statusCode).toBe(statusCodes.ok)
    const s3Calls = s3Mock.commandCalls(GetObjectCommand)
    expect(s3Calls[0].args[0].input.Key).toContain('agreements_15/')
  })

  test('uses retention period 20 for agreement ending in 10 years', async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('%PDF-1.4\n') })
    jest.spyOn(agreementDataHelper, 'getAgreementDataById').mockResolvedValue({
      agreementNumber: 'AGR-123',
      sbi: '123456789',
      status: 'offered',
      answers: {
        payment: {
          agreementEndDate: addYears(new Date(), 10).toISOString()
        }
      }
    })

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download',
      headers: {
        'x-encrypted-auth': 'mock-jwt-token'
      }
    })

    expect(res.statusCode).toBe(statusCodes.ok)
    const s3Calls = s3Mock.commandCalls(GetObjectCommand)
    expect(s3Calls[0].args[0].input.Key).toContain('agreements_20/')
  })

  test('uses custom short term prefix from config', async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('%PDF-1.4\n') })
    config.set('files.s3.shortTermPrefix', 'custom-short-term')
    jest.spyOn(agreementDataHelper, 'getAgreementDataById').mockResolvedValue({
      agreementNumber: 'AGR-123',
      sbi: '123456789',
      status: 'offered',
      answers: {
        payment: {
          agreementEndDate: addYears(new Date(), 2).toISOString()
        }
      }
    })

    const res = await server.inject({
      method: 'GET',
      url: '/AGR-123/1/download',
      headers: {
        'x-encrypted-auth': 'mock-jwt-token'
      }
    })

    expect(res.statusCode).toBe(statusCodes.ok)
    const s3Calls = s3Mock.commandCalls(GetObjectCommand)
    expect(s3Calls[0].args[0].input.Key).toContain('custom-short-term/')
  })
})
