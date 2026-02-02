import { MessageProviderPact } from '@pact-foundation/pact'
import { v4 as uuidv4 } from 'uuid'

import { config } from '~/src/config/index.js'
import { publishEvent as mockPublishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'
import { handleUpdateAgreementEvent } from '~/src/api/common/helpers/sqs-message-processor/update-agreement.js'
import { withdrawOffer as mockWithdrawOffer } from '~/src/api/agreement/helpers/withdraw-offer.js'
import { acceptOfferController } from '~/src/api/agreement/controllers/accept-offer.controller.js'
import { acceptOffer as mockAcceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import { updatePaymentHub as mockUpdatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'

vi.mock('~/src/api/common/helpers/sns-publisher.js')
vi.mock('~/src/api/agreement/helpers/withdraw-offer.js')
vi.mock('~/src/api/agreement/helpers/accept-offer.js')
vi.mock('~/src/api/agreement/helpers/update-payment-hub.js')
vi.mock('~/src/api/common/models/agreements.js', () => ({
  default: {
    createAgreementWithVersions: vi.fn().mockResolvedValue({
      agreementNumber: 'FPTT987654321'
    })
  }
}))

describe('sending events to GAS via SNS', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn()
  }

  let capturedMessage = null

  beforeEach(() => {
    vi.clearAllMocks()
    capturedMessage = null

    config.set('aws.sns.eventSource', 'farming-grants-agreements-api')

    // Mock publishEvent to construct the CloudEvents message like the real implementation
    mockPublishEvent.mockImplementation(({ type, time, data }) => {
      // Capture the latest message (for when there are multiple calls)
      capturedMessage = {
        id: uuidv4(),
        source: config.get('aws.sns.eventSource'),
        type,
        time,
        specVersion: '1.0', // TODO Technically AWS events use lowercase `specversion`
        datacontenttype: 'application/json',
        data
      }
    })

    // Mock acceptOffer to return accepted agreement data
    mockAcceptOffer.mockResolvedValue({
      agreementNumber: 'FPTT987654321',
      correlationId: 'b65c1dea-0328-47ab-ba26-f515db846110',
      clientRef: 'client-ref-002',
      code: 'frps-private-beta',
      status: 'accepted',
      signatureDate: '2025-08-19T09:36:45.131Z',
      payment: {
        agreementEndDate: '2028-09-01'
      },
      versions: [{ version: 1 }]
    })

    // Mock updatePaymentHub to return a claim ID
    mockUpdatePaymentHub.mockResolvedValue({ claimId: 'R00000001' })
  })

  const messagePact = new MessageProviderPact({
    provider: 'farming-grants-agreements-api',
    consumerVersionSelectors: [
      {
        consumer: 'fg-gas-backend',
        latest: true
      }
    ],
    publishVerificationResult: process.env.PACT_PUBLISH_VERIFICATION === 'true',
    providerVersion: process.env.SERVICE_VERSION ?? '1.0.0',
    failIfNoPactsFound: false,
    messageProviders: {
      'an agreement accepted message': async () => {
        capturedMessage = null

        config.set(
          'aws.sns.topic.agreementStatusUpdate.type',
          'cloud.defra.test.farming-grants-agreements-api.agreement.accepted'
        )

        // Create a mock request object for the controller
        const mockRequest = {
          auth: {
            credentials: {
              agreementData: {
                agreementNumber: 'FPTT987654321',
                correlationId: 'b65c1dea-0328-47ab-ba26-f515db846110',
                clientRef: 'client-ref-002',
                code: 'frps-private-beta',
                status: 'offered',
                payment: {
                  agreementEndDate: '2028-09-01'
                }
              }
            }
          },
          logger: mockLogger
        }

        const mockH = {
          response: vi.fn().mockReturnThis(),
          header: vi.fn().mockReturnThis(),
          code: vi.fn().mockReturnThis()
        }

        // Call the real acceptOfferController which calls acceptOffer, updatePaymentHub, and publishEvent
        await acceptOfferController(mockRequest, mockH)

        return capturedMessage
      },
      'an agreement created message': async () => {
        capturedMessage = null

        const agreementData = {
          ...sampleData.agreements[1],
          correlationId: 'b65c1dea-0328-47ab-ba26-f515db846110',
          clientRef: 'client-ref-002',
          code: 'frps-private-beta'
        }

        // Call the real createOffer function which calls publishEvent
        await createOffer('test-message-id', agreementData, mockLogger)

        return capturedMessage
      },
      'an agreement withdrawn message': async () => {
        capturedMessage = null

        config.set(
          'aws.sns.topic.agreementStatusUpdate.type',
          'cloud.defra.test.farming-grants-agreements-api.agreement.withdrawn'
        )

        const withdrawnAgreement = {
          agreement: { agreementNumber: 'FPTT123456789' },
          correlationId: 'a65c1dea-0328-47ab-ba26-f515db846110',
          clientRef: 'client-ref-003',
          code: 'frps-private-beta',
          status: 'withdrawn'
        }

        mockWithdrawOffer.mockResolvedValue(withdrawnAgreement)

        const incomingMessage = {
          id: 'test-message-id',
          source: 'fg-gas-backend',
          specversion: '1.0',
          type: 'cloud.defra.test.fg-gas-backend.agreement.withdraw',
          datacontenttype: 'application/json',
          data: {
            clientRef: 'client-ref-003',
            agreementNumber: 'FPTT123456789',
            status: 'withdrawn'
          }
        }

        // Call the real handleUpdateAgreementEvent which calls withdrawOffer then publishEvent
        await handleUpdateAgreementEvent(
          incomingMessage.id,
          incomingMessage,
          mockLogger
        )

        return capturedMessage
      }
    }
  })

  it('should validate all GAS message structures', async () => {
    const verify = await messagePact.verify()

    expect(verify).toBeTruthy()

    return verify
  })
})
