import { vi } from 'vitest'
import path from 'node:path'

import { MessageProviderPact } from '@pact-foundation/pact'

import { config } from '#~/config/index.js'
import { createServer } from '#~/api/index.js'
import { createOffer } from '#~/api/agreement/helpers/create-offer.js'
import { withdrawOffer } from '#~/api/agreement/helpers/withdraw-offer.js'
import { acceptOffer } from '#~/api/agreement/helpers/accept-offer.js'
import { unacceptOffer } from '#~/api/agreement/helpers/unaccept-offer.js'
import { getAgreementDataBySbi } from '#~/api/agreement/helpers/get-agreement-data.js'
import { updatePaymentHub } from '#~/api/agreement/helpers/update-payment-hub.js'
import { handleUpdateAgreementEvent } from '#~/api/common/helpers/sqs-message-processor/update-agreement.js'
import * as jwtAuth from '#~/api/common/helpers/jwt-auth.js'
import { publishEvent as mockPublishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { getJsonPacts } from '#~/contracts/test-helpers/pact.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'

vi.mock('#~/api/agreement/helpers/accept-offer.js')
vi.mock('#~/api/agreement/helpers/unaccept-offer.js')
vi.mock('#~/api/agreement/helpers/withdraw-offer.js')
vi.mock('#~/api/agreement/helpers/update-payment-hub.js')
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
  '../fg-gas-backend/src/contracts/consumer/pacts'
)

const MOCK_DATE = '2025-10-06T16:40:21.951Z'
const MOCK_TIME = '2025-10-06T16:41:59.497Z'
const PROVIDER_NAME = 'farming-grants-agreements-api'
const SNS_EVENT_SOURCE_KEY = 'aws.sns.eventSource'

const mockLogger = {
  info: vi.fn(),
  error: vi.fn()
}

const mockAgreementData = {
  status: 'offered',
  ...sampleData.agreements[1]
}

const setupMocks = () => {
  vi.clearAllMocks()

  acceptOffer.mockReset()
  unacceptOffer.mockReset()
  withdrawOffer.mockReset()
  getAgreementDataBySbi.mockReset()
  updatePaymentHub.mockReset()

  acceptOffer.mockResolvedValue({
    ...mockAgreementData,
    signatureDate: '2024-01-01T00:00:00.000Z',
    status: 'accepted'
  })
  unacceptOffer.mockResolvedValue()
  updatePaymentHub.mockResolvedValue({ claimId: 'R00000001' })

  withdrawOffer.mockResolvedValue({
    agreement: { agreementNumber: 'FPTT123456789' },
    clientRef: 'mockClientRef',
    code: 'mockCode',
    correlationId: 'mockCorrelationId',
    status: 'withdrawn',
    updatedAt: MOCK_DATE
  })

  getAgreementDataBySbi.mockResolvedValue(mockAgreementData)

  vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
    valid: true,
    source: 'defra',
    sbi: '106284736'
  })
}

/**
 * Transform the captured publishEvent input into a complete CloudEvent message
 * This simulates what sns-publisher.js does internally
 */
const buildCloudEventMessage = (capturedInput) => {
  const { type, data } = capturedInput
  return {
    id: '12345678-1234-1234-1234-123456789012',
    source: config.get(SNS_EVENT_SOURCE_KEY),
    specversion: '1.0',
    specVersion: '1.0', // TODO Technically AWS events use lowercase `specversion`
    type,
    time: MOCK_TIME,
    datacontenttype: 'application/json',
    data: {
      ...data,
      date: MOCK_DATE
    }
  }
}

const createdMessageProvider = async () => {
  let message
  try {
    mockPublishEvent.mockResolvedValue()

    config.set(SNS_EVENT_SOURCE_KEY, PROVIDER_NAME)

    await createOffer('aws-message-id', mockAgreementData, mockLogger)

    message = mockPublishEvent.mock.calls[0][0]

    message.specVersion = message.specVersion ?? '1.0'
    message.data.correlationId = 'mockCorrelationId'
    message.data.date = '2025-10-06T16:40:21.951Z'
    message.time = '2025-10-06T16:41:59.497Z'
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    message = 'Publish event was not called, check above for errors'
  }
  return message
}

const acceptedMessageProvider = async (server) => {
  let message
  try {
    // Reset mocks to ensure clean state
    mockPublishEvent.mockClear()

    // Set the config to use the correct event type for accepted
    config.set(SNS_EVENT_SOURCE_KEY, PROVIDER_NAME)
    config.set(
      'aws.sns.topic.agreementStatusUpdate.type',
      'cloud.defra.test.farming-grants-agreements-api.agreement.accepted'
    )

    await server.inject({
      method: 'POST',
      url: '/',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    const capturedInput = mockPublishEvent.mock.calls[0][0]
    message = buildCloudEventMessage(capturedInput)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    message = 'Publish event was not called, check above for errors'
  }
  return message
}

const withdrawnMessageProvider = async () => {
  let message
  try {
    // Reset mocks to ensure clean state
    mockPublishEvent.mockClear()

    // Set the config to use the correct event type for withdrawn
    config.set(SNS_EVENT_SOURCE_KEY, PROVIDER_NAME)
    config.set(
      'aws.sns.topic.agreementStatusUpdate.type',
      'cloud.defra.test.farming-grants-agreements-api.agreement.withdrawn'
    )

    // Call the real SQS message handler which calls withdrawOffer and publishEvent
    await handleUpdateAgreementEvent(
      '123-456-789',
      {
        id: '12-34-56-78-90',
        source: 'fg-gas-backend',
        specversion: '1.0',
        type: 'cloud.defra.test.fg-gas-backend.application.status.updated',
        datacontenttype: 'application/json',
        data: {
          clientRef: 'mockClientRef',
          agreementNumber: 'FPTT123456789',
          status: 'withdrawn'
        }
      },
      mockLogger
    )

    const capturedInput = mockPublishEvent.mock.calls[0][0]
    message = buildCloudEventMessage(capturedInput)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    message = 'Publish event was not called, check above for errors'
  }
  return message
}

describe('sending events via SNS to GAS', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

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
    setupMocks()
  })

  const messagePact = new MessageProviderPact({
    provider: 'farming-grants-agreements-api',
    ...(process.env.CI
      ? {
          consumerVersionSelectors: [
            {
              consumer: 'fg-gas-backend',
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
      'an agreement offer has been created': () => {
        mockPublishEvent.mockResolvedValue()
      },
      'an agreement offer has been withdrawn': () => {
        mockPublishEvent.mockResolvedValue()
      },
      'an agreement offer has been accepted': () => {
        mockPublishEvent.mockResolvedValue()
      }
    },
    messageProviders: {
      'an agreement created message': createdMessageProvider,
      'an agreement withdrawn message': withdrawnMessageProvider,
      'an agreement accepted message': () => acceptedMessageProvider(server)
    }
  })

  it('should validate the message structure', async () => {
    const verify = await messagePact.verify()

    expect(verify).toBeTruthy()

    return verify
  })
})
