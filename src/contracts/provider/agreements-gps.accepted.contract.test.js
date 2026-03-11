import crypto from 'node:crypto'
import path from 'node:path'

import { vi } from 'vitest'
import { MessageProviderPact } from '@pact-foundation/pact'

import { config } from '#~/config/index.js'
import { createServer } from '#~/api/index.js'
import * as jwtAuth from '#~/api/common/helpers/jwt-auth.js'
import { publishEvent as mockPublishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { getJsonPacts } from '#~/contracts/test-helpers/pact.js'
import { seedDatabase } from '#~/api/common/helpers/seed-database.js'
import agreements from '#~/api/common/helpers/sample-data/agreements.js'
import { buildIsolatedMongoOptions } from '#~/contracts/test-helpers/mongo.js'

vi.unmock('mongoose')

vi.mock('#~/api/common/helpers/jwt-auth.js')
vi.mock('#~/api/common/helpers/sns-publisher.js')

const localPactDir = path.resolve(
  process.cwd(),
  '../grants-payment-service/src/contracts/consumer/pacts/generated/consumer-agreements-to-gps'
)

const calculatedPayment = {
  message: 'success',
  payment: {
    agreementStartDate: '2025-12-01',
    agreementEndDate: '2028-12-01',
    frequency: 'Quarterly',
    agreementTotalPence: 242298,
    annualTotalPence: 80766,

    parcelItems: {
      1: {
        code: 'CMOR1',
        description: 'Assess moorland',
        unit: 'ha',
        quantity: 50.53,
        rateInPence: 1060,
        annualPaymentPence: 53566,
        parcelId: 'SE12 3456 7890',
        version: '1.0.0'
      }
    },

    agreementLevelItems: {
      1: {
        code: 'CMOR1',
        description: 'Agreement-level item',
        annualPaymentPence: 27200,
        version: '1.0.0'
      }
    },

    payments: [
      {
        paymentDate: '2026-03-05',
        totalPaymentPence: 20197,
        lineItems: [{ agreementLevelItemId: 1, paymentPence: 20197 }]
      },
      {
        paymentDate: '2026-06-05',
        totalPaymentPence: 20191,
        lineItems: [{ agreementLevelItemId: 1, paymentPence: 20191 }]
      },
      {
        paymentDate: '2026-09-07',
        totalPaymentPence: 20191,
        lineItems: [{ agreementLevelItemId: 1, paymentPence: 20191 }]
      },
      {
        paymentDate: '2026-12-07',
        totalPaymentPence: 20191,
        lineItems: [{ agreementLevelItemId: 1, paymentPence: 20191 }]
      }
    ]
  }
}

describe('sending a create grant payment event via SNS', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server
  let originalFetch

  const agreement = agreements[1]
  const mockSbi = agreement.identifiers.sbi

  beforeAll(async () => {
    originalFetch = global.fetch
    global.fetch = vi.fn((url, options) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/v2/payments/calculate')) {
        return Promise.resolve({
          ok: true,
          headers: { get: vi.fn().mockReturnValue('application/json') },
          json: vi.fn().mockResolvedValue(calculatedPayment)
        })
      }
      return originalFetch(url, options)
    })

    const mongoOverrides = buildIsolatedMongoOptions(
      'grants-payment-service-contract'
    )

    // Configure the application
    config.set('port', crypto.randomInt(30001, 65535))
    config.set('mongoUri', mongoOverrides.mongoUrl)
    config.set('files.s3.bucket', 'mockBucket')
    config.set('files.s3.region', 'mockRegion')
    config.set('featureFlags.seedDb', false)

    server = await createServer({
      disableSQS: true,
      ...mongoOverrides
    })
    await server.start()
    await seedDatabase(console, [agreement])
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }

    global.fetch = originalFetch
  })

  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
      valid: true,
      source: 'defra',
      sbi: mockSbi
    })
  })

  const messagePact = new MessageProviderPact({
    provider: 'farming-grants-agreements-api',
    ...(process.env.CI
      ? {
          consumerVersionSelectors: [
            {
              consumer: 'grants-payment-service',
              latest: true
            }
          ],
          publishVerificationResult:
            process.env.PACT_PUBLISH_VERIFICATION === 'true',
          providerVersion: process.env.SERVICE_VERSION ?? '1.0.0',
          failIfNoPactsFound: false
        }
      : {
          logLevel: 'debug',
          pactUrls: getJsonPacts(localPactDir)
        }),
    stateHandlers: {
      'an agreement offer has been accepted': async () => {
        mockPublishEvent.mockResolvedValue()
        return Promise.resolve()
      }
    },
    messageProviders: {
      'a notification with the grant payment schedule': async () => {
        let message
        try {
          config.set(
            'aws.sns.topic.createPayment.arn',
            'arn:aws:sns:eu-west-2:000000000000:create_payment.fifo'
          )
          config.set(
            'aws.sns.topic.createPayment.type',
            'cloud.defra.dev.farming-grants-agreements-api.payment.create'
          )

          await server.inject({
            method: 'POST',
            url: `/`,
            headers: {
              'x-encrypted-auth': 'valid-jwt-token'
            }
          })

          const acceptedPublishCall = mockPublishEvent.mock.calls.find(
            ([event]) =>
              event?.type ===
              'cloud.defra.dev.farming-grants-agreements-api.payment.create'
          )

          if (!acceptedPublishCall) {
            throw new Error(
              `Accepted event was not published. Calls were: ${JSON.stringify(
                mockPublishEvent.mock.calls.map(([event]) => ({
                  type: event?.type,
                  topicArn: event?.topicArn,
                  status: event?.data?.status
                })),
                null,
                2
              )}`
            )
          }

          message = acceptedPublishCall[0]
          message.specversion = message.specversion ?? '1.0'
          message.time = '2025-10-06T16:41:59.497Z'
        } catch (err) {
          console.error(err)
          message = 'Publish event was not called, check above for errors'
        }

        return message
      }
    }
  })

  it('should validate the message structure', async () => {
    const verify = await messagePact.verify()

    expect(verify).toBeTruthy()

    return verify
  })
})
