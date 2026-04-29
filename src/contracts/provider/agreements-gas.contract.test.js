import { vi } from 'vitest'
import path from 'node:path'

import { MessageProviderPact } from '@pact-foundation/pact'

import { config } from '#~/config/index.js'
import { createServer } from '#~/api/index.js'
import { createOffer } from '#~/api/agreement/helpers/create-offer.js'
import { withdrawOffer } from '#~/api/agreement/helpers/withdraw-offer.js'
import { cancelOffer } from '#~/api/agreement/helpers/cancel-offer.js'
import { terminateAgreement } from '#~/api/agreement/helpers/terminate-agreement.js'
import { unacceptOffer } from '#~/api/agreement/helpers/unaccept-offer.js'
import { getAgreementDataBySbi } from '#~/api/agreement/helpers/get-agreement-data.js'
import { handleUpdateAgreementEvent } from '#~/api/common/helpers/sqs-message-processor/update-agreement.js'
import * as jwtAuth from '#~/api/common/helpers/jwt-auth.js'
import { publishEvent as mockPublishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { getJsonPacts } from '#~/contracts/test-helpers/pact.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'
import { createGrantPaymentFromAgreement } from '#~/api/common/helpers/create-grant-payment-from-agreement.js'
import { sendGrantPaymentEvent } from '#~/api/common/helpers/send-grant-payment-event.js'
import agreementsModel from '#~/api/common/models/agreements.js'
import * as landGrantsAdapter from '#~/api/adapter/land-grants-adapter.js'

vi.mock('#~/api/common/models/agreements.js', () => {
  return {
    default: {
      updateOneAgreementVersion: vi.fn()
    }
  }
})

vi.mock('#~/api/adapter/land-grants-adapter.js', () => {
  return {
    calculatePaymentsBasedOnParcelsWithActions: vi.fn()
  }
})

vi.mock('#~/api/agreement/helpers/unaccept-offer.js')
vi.mock('#~/api/agreement/helpers/withdraw-offer.js')
vi.mock('#~/api/agreement/helpers/cancel-offer.js')
vi.mock('#~/api/agreement/helpers/terminate-agreement.js')
vi.mock(
  '#~/api/agreement/helpers/get-agreement-data.js',
  async (importOriginal) => {
    const actual = await importOriginal()
    return { __esModule: true, ...actual, getAgreementDataBySbi: vi.fn() }
  }
)
vi.mock('#~/api/common/helpers/jwt-auth.js')
vi.mock('#~/api/common/helpers/sns-publisher.js')
vi.mock('#~/api/common/helpers/create-grant-payment-from-agreement.js')
vi.mock('#~/api/common/helpers/send-grant-payment-event.js')

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
  ...sampleData.agreements[1],
  application: sampleData.agreements[1].answers.application,
  payment: sampleData.agreements[1].answers.payment
}

const setupMocks = () => {
  vi.clearAllMocks()
  unacceptOffer.mockReset()
  withdrawOffer.mockReset()
  cancelOffer.mockReset()
  terminateAgreement.mockReset()
  getAgreementDataBySbi.mockReset()
  sendGrantPaymentEvent.mockReset()

  unacceptOffer.mockResolvedValue()

  agreementsModel.updateOneAgreementVersion.mockResolvedValue({
    ...mockAgreementData,
    signatureDate: '2024-01-01T00:00:00.000Z',
    status: 'accepted'
  })

  landGrantsAdapter.calculatePaymentsBasedOnParcelsWithActions.mockResolvedValue(
    mockAgreementData.payment
  )

  sendGrantPaymentEvent.mockResolvedValue({
    claimId: 'R00000001'
  })

  withdrawOffer.mockResolvedValue({
    agreement: { agreementNumber: 'FPTT123456789' },
    clientRef: 'mockClientRef',
    code: 'mockCode',
    correlationId: 'mockCorrelationId',
    status: 'withdrawn',
    updatedAt: MOCK_DATE
  })

  cancelOffer.mockResolvedValue({
    agreement: { agreementNumber: 'FPTT123456789' },
    clientRef: 'mockClientRef',
    code: 'mockCode',
    correlationId: 'mockCorrelationId',
    status: 'cancelled',
    updatedAt: MOCK_DATE
  })

  terminateAgreement.mockResolvedValue({
    agreement: { agreementNumber: 'FPTT123456789' },
    clientRef: 'mockClientRef',
    code: 'mockCode',
    correlationId: 'mockCorrelationId',
    status: 'terminated',
    updatedAt: MOCK_DATE
  })

  getAgreementDataBySbi.mockResolvedValue(mockAgreementData)

  createGrantPaymentFromAgreement.mockReset()

  createGrantPaymentFromAgreement.mockResolvedValue({
    agreementNumber: 'SFI987654321',
    clientRef: 'client-ref-002',
    code: 'frps-private-beta'
  })

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
    mockPublishEvent.mockClear()

    config.set(SNS_EVENT_SOURCE_KEY, PROVIDER_NAME)
    config.set(
      'aws.sns.topic.agreementStatusUpdate.type',
      'cloud.defra.test.farming-grants-agreements-api.agreement.accepted'
    )
    config.set(
      'aws.sns.topic.createPayment.arn',
      'arn:aws:sns:eu-west-2:000000000000:create_payment.fifo'
    )
    config.set(
      'aws.sns.topic.createPayment.type',
      'cloud.defra.test.farming-grants-agreements-api.payment.create'
    )

    const response = await server.inject({
      method: 'POST',
      url: '/',
      headers: {
        'x-encrypted-auth': 'valid-jwt-token'
      }
    })

    if (response.statusCode !== 200) {
      console.error('Inject failed:', response.statusCode, response.result)
    }

    const acceptedType = config.get('aws.sns.topic.agreementStatusUpdate.type')

    const acceptedPublishCall = mockPublishEvent.mock.calls.find(
      ([event]) => event?.type === acceptedType
    )

    if (!acceptedPublishCall) {
      throw new Error(
        `Accepted agreement event was not published. Calls were: ${JSON.stringify(
          mockPublishEvent.mock.calls.map(([event]) => ({
            type: event?.type,
            topicArn: event?.topicArn
          })),
          null,
          2
        )}`
      )
    }

    const capturedInput = acceptedPublishCall[0]
    message = buildCloudEventMessage(capturedInput)
  } catch (err) {
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

const cancelledMessageProvider = async () => {
  let message
  try {
    mockPublishEvent.mockClear()

    config.set(SNS_EVENT_SOURCE_KEY, PROVIDER_NAME)
    config.set(
      'aws.sns.topic.agreementStatusUpdate.type',
      'cloud.defra.test.farming-grants-agreements-api.agreement.cancelled'
    )

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
          status: 'cancelled'
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

const terminatedMessageProvider = async () => {
  let message
  try {
    mockPublishEvent.mockClear()

    config.set(SNS_EVENT_SOURCE_KEY, PROVIDER_NAME)
    config.set(
      'aws.sns.topic.agreementStatusUpdate.type',
      'cloud.defra.test.farming-grants-agreements-api.agreement.terminated'
    )

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
          status: 'terminated'
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
    failIfNoPactsFound: false,
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
          providerVersion: process.env.SERVICE_VERSION ?? '1.0.0'
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
      },
      'an agreement offer has been cancelled': () => {
        mockPublishEvent.mockResolvedValue()
      },
      'an agreement has been terminated': () => {
        mockPublishEvent.mockResolvedValue()
      }
    },
    messageProviders: {
      'an agreement created message': createdMessageProvider,
      'an agreement withdrawn message': withdrawnMessageProvider,
      'an agreement accepted message': () => acceptedMessageProvider(server),
      'an agreement cancelled message': cancelledMessageProvider,
      'an agreement terminated message': terminatedMessageProvider
    }
  })

  it('should validate the message structure', async () => {
    const verify = await messagePact.verify()

    expect(verify).toBeTruthy()

    return verify
  })
})
