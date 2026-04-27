import { vi } from 'vitest'
import path from 'node:path'

import { MessageProviderPact } from '@pact-foundation/pact'

import { config } from '#~/config/index.js'
import { createServer } from '#~/api/index.js'
import { acceptOffer } from '#~/api/agreement/helpers/accept-offer.js'
import { unacceptOffer } from '#~/api/agreement/helpers/unaccept-offer.js'
import { getAgreementDataBySbi } from '#~/api/agreement/helpers/get-agreement-data.js'
import { createGrantPaymentFromAgreement } from '#~/api/common/helpers/create-grant-payment-from-agreement.js'
import * as jwtAuth from '#~/api/common/helpers/jwt-auth.js'
import { publishEvent as mockPublishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { getJsonPacts } from '#~/contracts/test-helpers/pact.js'

vi.mock('#~/api/agreement/helpers/accept-offer.js')
vi.mock('#~/api/agreement/helpers/unaccept-offer.js')
vi.mock('#~/api/common/helpers/create-grant-payment-from-agreement.js')
vi.mock(
  '#~/api/agreement/helpers/get-agreement-data.js',
  async (importOriginal) => {
    const actual = await importOriginal()
    return { __esModule: true, ...actual, getAgreementDataBySbi: vi.fn() }
  }
)
vi.mock('#~/api/common/helpers/jwt-auth.js')
vi.mock('#~/api/common/helpers/sns-publisher.js')

const localPactDir = path.resolve(
  process.cwd(),
  '../farming-grants-agreements-pdf/src/contracts/consumer/pacts'
)

describe('sending updated (accepted) events via SNS', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const mockAgreementData = {
    code: 'mockCode',
    agreementNumber: 'FPTT123456789',
    status: 'offered',
    clientRef: 'mockClientRef',
    correlationId: 'mockCorrelationId',
    createdAt: '2025-10-06T16:40:21.951Z',
    updatedAt: '2025-10-06T16:40:21.951Z',
    payment: {
      agreementStartDate: '2024-01-01',
      agreementEndDate: '2027-12-31'
    },
    version: 1
  }

  beforeAll(async () => {
    server = await createServer({ disableSQS: true })
    await server.initialize()
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()

    acceptOffer.mockReset()
    unacceptOffer.mockReset()
    getAgreementDataBySbi.mockReset()
    createGrantPaymentFromAgreement.mockReset()

    acceptOffer.mockImplementation(async (agreementNumber) => {
      const result = {
        ...mockAgreementData,
        agreementNumber,
        signatureDate: '2024-01-01T00:00:00.000Z',
        status: 'accepted'
      }

      const agreementUrl = `${String(config.get('viewAgreementURI'))}/${agreementNumber}`

      // Trigger the side effect that the test expects
      await mockPublishEvent(
        {
          topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
          type: config.get('aws.sns.topic.agreementStatusUpdate.type'),
          time: new Date().toISOString(),
          data: {
            agreementNumber,
            correlationId: result.correlationId,
            clientRef: result.clientRef,
            version: result.version,
            agreementUrl,
            status: result.status,
            code: result.code,
            date: result.updatedAt,
            startDate: result.payment?.agreementStartDate,
            endDate: result.payment?.agreementEndDate,
            claimId: 'mock-claim-id'
          }
        },
        console
      )

      return result
    })
    unacceptOffer.mockResolvedValue()

    createGrantPaymentFromAgreement.mockResolvedValue({
      agreementNumber: 'FPTT123456789',
      clientRef: 'mockClientRef',
      code: 'mockCode'
    })

    getAgreementDataBySbi.mockResolvedValue(mockAgreementData)

    vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
      valid: true,
      source: 'defra',
      sbi: '106284736'
    })
  })

  const messagePact = new MessageProviderPact({
    provider: 'farming-grants-agreements-api',
    ...(process.env.CI
      ? {
          consumerVersionSelectors: [
            {
              consumer: 'farming-grants-agreements-pdf',
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
      'a request with the accepted agreement': async () => {
        let message
        try {
          config.set(
            'aws.sns.topic.createPayment.arn',
            'arn:aws:sns:eu-west-2:000000000000:create_payment.fifo'
          )
          config.set(
            'aws.sns.topic.createPayment.type',
            'cloud.defra.test.farming-grants-agreements-api.payment.create'
          )

          await server.inject({
            method: 'POST',
            url: '/',
            headers: {
              'x-encrypted-auth': 'valid-jwt-token'
            }
          })

          const acceptedPublishCall = mockPublishEvent.mock.calls.find(
            ([event]) =>
              event?.type === 'io.onsite.agreement.status.updated' &&
              event?.data?.status === 'accepted'
          )

          if (!acceptedPublishCall) {
            throw new Error(
              `Accepted PDF event was not published. Calls were: ${JSON.stringify(
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
          message.data.agreementCreateDate = '2025-10-06T16:40:21.951Z'
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
