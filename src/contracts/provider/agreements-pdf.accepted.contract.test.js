import { vi } from 'vitest'
import path from 'node:path'

import { MessageProviderPact } from '@pact-foundation/pact'

import { createServer } from '~/src/api/index.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import { unacceptOffer } from '~/src/api/agreement/helpers/unaccept-offer.js'
import { getAgreementDataBySbi } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'
import { publishEvent as mockPublishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { getJsonPacts } from '~/src/contracts/consumer/pact-test-helpers.js'

vi.mock('~/src/api/agreement/helpers/accept-offer.js')
vi.mock('~/src/api/agreement/helpers/unaccept-offer.js')
vi.mock('~/src/api/agreement/helpers/update-payment-hub.js')
vi.mock(
  '~/src/api/agreement/helpers/get-agreement-data.js',
  async (importOriginal) => {
    const actual = await importOriginal()
    return { __esModule: true, ...actual, getAgreementDataBySbi: vi.fn() }
  }
)
vi.mock('~/src/api/common/helpers/jwt-auth.js')
vi.mock('~/src/api/common/helpers/sns-publisher.js')

const localPactDir = path.resolve(
  process.cwd(),
  '../farming-grants-agreements-pdf/src/contracts/consumer/pacts'
)

describe('sending updated (accepted) events via SNS', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  const mockAgreementData = {
    code: 'mockCode',
    agreementNumber: 'SFI123456789',
    status: 'offered',
    clientRef: 'mockClientRef',
    correlationId: 'mockCorrelationId',
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

    // Reset mock implementations
    acceptOffer.mockReset()
    unacceptOffer.mockReset()
    getAgreementDataBySbi.mockReset()
    updatePaymentHub.mockReset()

    acceptOffer.mockResolvedValue({
      ...mockAgreementData,
      signatureDate: '2024-01-01T00:00:00.000Z',
      status: 'accepted'
    })
    unacceptOffer.mockResolvedValue()
    updatePaymentHub.mockResolvedValue()

    // Setup default mock implementations with complete data structure
    getAgreementDataBySbi.mockResolvedValue(mockAgreementData)

    // Mock JWT auth functions to return valid authorization by default
    vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
      valid: true,
      source: 'defra',
      sbi: '106284736'
    })
  })

  const messagePact = new MessageProviderPact({
    provider: 'farming-grants-agreements-api',
    consumer: 'farming-grants-agreements-pdf',
    ...(process.env.CI
      ? {
          pactBrokerUrl:
            process.env.PACT_BROKER_URL ??
            'https://ffc-pact-broker.azure.defra.cloud',
          consumerVersionSelectors: [
            {
              consumer: 'farming-grants-agreements-pdf',
              latest: true
            }
          ],
          pactBrokerUsername: process.env.PACT_USER,
          pactBrokerPassword: process.env.PACT_PASS,
          publishVerificationResult:
            process.env.PACT_PUBLISH_VERIFICATION === 'true',
          providerVersion: process.env.SERVICE_VERSION ?? '1.0.0',
          failIfNoPactsFound: false
        }
      : {
          logLevel: 'debug',
          // Hard coded path for local testing
          pactUrls: getJsonPacts(localPactDir)
        }),
    // Consumer.given
    stateHandlers: {
      'an agreement offer has been accepted': async () => {
        // Given Setup mock state (like beforeEach)
        mockPublishEvent.mockResolvedValue()

        return Promise.resolve()
      }
    },
    // Consumer.expectsToReceive
    messageProviders: {
      'a request with the accepted agreement': async () => {
        // Respond with data based on the state handler mock state
        let message
        try {
          await server.inject({
            method: 'POST',
            url: '/',
            headers: {
              'x-encrypted-auth': 'valid-jwt-token'
            }
          })

          message = mockPublishEvent.mock.calls[0][0]

          message.specVersion = message.specVersion ?? '1.0'
          message.data.date = '2025-10-06T16:40:21.951Z'
          message.time = '2025-10-06T16:41:59.497Z'
        } catch (err) {
          // eslint-disable-next-line no-console
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
