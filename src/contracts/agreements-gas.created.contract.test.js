import path from 'node:path'

import { MessageProviderPact } from '@pact-foundation/pact'

import { publishEvent as mockPublishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'

jest.mock('~/src/api/common/helpers/sns-publisher.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  doesAgreementExist: jest.fn(false)
}))
jest.mock('~/src/api/common/models/agreements.js', () => ({
  createAgreementWithVersions: jest.fn().mockResolvedValue({
    agreementNumber: 'mockAgreementNumber'
  })
}))

describe('sending updated (created) event via SNS', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
  }

  const messagePact = new MessageProviderPact({
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
    },
    provider: 'sns-agreements:agreement_status_updated',
    consumer: 'sqs-gas',
    providerVersion: '1.0.0',
    pactUrls: [
      path.resolve(
        'src',
        'contracts',
        'pacts',
        'sns-agreements:agreement_status_updated:created.json'
      )
    ],
    pactfileWriteMode: 'update'
  })

  it('should validate the message structure', async () => {
    const verify = await messagePact.verify()

    expect(verify).toBeTruthy()

    return verify
  })
})
