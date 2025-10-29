import { MessageProviderPact } from '@pact-foundation/pact'

import { config } from '~/src/config/index.js'
import { publishEvent as mockPublishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'

jest.mock('~/src/api/common/helpers/sns-publisher.js')
jest.mock('~/src/api/common/models/agreements.js', () => ({
  updateOneAgreementVersion: jest.fn().mockResolvedValue('created')
}))

describe('sending updated (accepted) events via SNS', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
  }

  const messagePact = new MessageProviderPact({
    provider: 'farming-grants-agreements-api-sns',
    consumer: 'farming-grants-agreements-pdf-sqs',
    pactBrokerUrl:
      process.env.PACT_BROKER_URL ??
      'https://ffc-pact-broker.azure.defra.cloud',
    consumerVersionSelectors: [{ latest: true }],
    pactBrokerUsername: process.env.PACT_BROKER_USERNAME,
    pactBrokerPassword: process.env.PACT_BROKER_PASSWORD,
    publishVerificationResult: true,
    providerVersion: process.env.SERVICE_VERSION ?? '1.0.0',
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
          config.set('files.s3.bucket', 'mockS3Bucket')
          config.set('files.s3.region', 'mockS3Region')

          await acceptOffer(
            'SFI123456789',
            {
              ...sampleData.agreements[1],
              correlationId: 'mockCorrelationId',
              clientRef: 'mockClientRef',
              version: 'mockVersion',
              code: 'mockCode'
            },
            'http://example.com/mockAgreementUrl',
            mockLogger
          )

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
