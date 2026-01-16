import { MessageProviderPact } from '@pact-foundation/pact'

import { config } from '~/src/config/index.js'
import { publishEvent as mockPublishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'

vi.mock('~/src/api/common/helpers/sns-publisher.js')
vi.mock('~/src/api/common/models/agreements.js', () => ({
  updateOneAgreementVersion: vi.fn().mockResolvedValue('created')
}))

describe('sending updated (accepted) events via SNS', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn()
  }

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
      'agreement accepted': async () => {
        let message
        try {
          mockPublishEvent.mockResolvedValue()

          config.set('files.s3.bucket', 'mockS3Bucket')
          config.set('files.s3.region', 'mockS3Region')

          await acceptOffer(
            'SFI123456789',
            {
              ...sampleData.agreements[1],
              correlationId: 'mockCorrelationId',
              clientRef: 'mockClientRef',
              version: 'mockVersion',
              code: 'mockCode',
              answers: {
                ...sampleData.agreements[1].answers
              },
              payment: {
                agreementEndDate: '2027-12-31'
              }
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
