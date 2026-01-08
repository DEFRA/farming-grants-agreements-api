import { MessageProviderPact } from '@pact-foundation/pact'

import { publishEvent as mockPublishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'

vi.mock('~/src/api/common/helpers/sns-publisher.js')
vi.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  doesAgreementExist: vi.fn(false)
}))
vi.mock('~/src/api/common/models/agreements.js', () => ({
  createAgreementWithVersions: vi.fn().mockResolvedValue({
    agreementNumber: 'mockAgreementNumber'
  })
}))

// Reason: Pact consumer tests need to be setup in fg-gas-backend
describe.skip('sending updated (created) event via SNS', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn()
  }

  const messagePact = new MessageProviderPact({
    provider: 'farming-grants-agreements-api-sns',
    consumer: 'fg-gas-backend-sqs',
    pactBrokerUrl:
      process.env.PACT_BROKER_URL ??
      'https://ffc-pact-broker.azure.defra.cloud',
    consumerVersionSelectors: [{ latest: true }],
    pactBrokerUsername: process.env.PACT_USER,
    pactBrokerPassword: process.env.PACT_PASS,
    publishVerificationResult: process.env.PACT_PUBLISH_VERIFICATION === 'true',
    providerVersion: process.env.SERVICE_VERSION ?? '1.0.0',
    messageProviders: {
      'agreement created': async () => {
        let message
        try {
          mockPublishEvent.mockResolvedValue()

          await createOffer(
            'aws-message-id',
            sampleData.agreements[1],
            mockLogger
          )

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
    }
  })

  it('should validate the message structure', async () => {
    const verify = await messagePact.verify()

    expect(verify).toBeTruthy()

    return verify
  })
})
