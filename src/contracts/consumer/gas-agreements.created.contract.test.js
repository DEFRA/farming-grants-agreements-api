import path from 'node:path'

import { MessageConsumerPact, Matchers } from '@pact-foundation/pact'

import { handleCreateAgreementEvent } from '~/src/api/common/helpers/sqs-message-processor/create-agreement.js'
import { createOffer as mockCreateOffer } from '~/src/api/agreement/helpers/create-offer.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'

jest.mock('~/src/api/agreement/helpers/create-offer.js')
jest.mock('~/src/api/common/helpers/sns-publisher.js')

describe('receiving events from the GAS SQS queue and processing them', () => {
  const messagePact = new MessageConsumerPact({
    consumer: 'farming-grants-agreements-api-sqs',
    provider: 'fg-gas-backend-sns',
    dir: path.resolve('src', 'contracts', 'consumer', 'pacts'),
    pactfileWriteMode: 'update'
  })

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
  }

  it('should create an agreement offer when receiving an AWS SQS event from GAS', () => {
    mockCreateOffer.mockResolvedValue({
      agreementNumber: 'mockAgreementNumber'
    })

    return messagePact
      .given('agreement created event')
      .expectsToReceive('an agreement created message')
      .withContent({
        id: '12-34-56-78-90',
        source: Matchers.like('fg-gas-backend'),
        specVersion: '1.0',
        type: 'cloud.defra.test.fg-gas-backend.agreement.create',
        datacontenttype: 'application/json',
        data: sampleData.agreements[1]
      })
      .verify(async (message) => {
        await handleCreateAgreementEvent(
          message.contents.id,
          message.contents,
          mockLogger
        )

        expect(mockLogger.info).toHaveBeenNthCalledWith(
          1,
          'Creating agreement from event: 12-34-56-78-90'
        )
        expect(mockLogger.info).toHaveBeenNthCalledWith(
          2,
          'Agreement created: mockAgreementNumber'
        )
        expect(mockCreateOffer).toHaveBeenCalledWith(
          '12-34-56-78-90',
          sampleData.agreements[1],
          mockLogger
        )
      })
  })
})
