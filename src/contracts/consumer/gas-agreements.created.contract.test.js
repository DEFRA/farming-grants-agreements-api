import path from 'node:path'

import { vi } from 'vitest'
import { MessageConsumerPact, MatchersV2 } from '@pact-foundation/pact'

import { handleCreateAgreementEvent } from '~/src/api/common/helpers/sqs-message-processor/create-agreement.js'
import { createOffer as mockCreateOffer } from '~/src/api/agreement/helpers/create-offer.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'

vi.mock('~/src/api/agreement/helpers/create-offer.js')
vi.mock('~/src/api/common/helpers/sns-publisher.js')

const { like, uuid, iso8601DateTimeWithMillis } = MatchersV2

const mockAgreement = sampleData.agreements[1]

describe('receiving events from the GAS SQS queue and processing them', () => {
  const messagePact = new MessageConsumerPact({
    consumer: 'farming-grants-agreements-api-sqs',
    provider: 'fg-gas-backend-sns',
    dir: path.resolve('src', 'contracts', 'consumer', 'pacts'),
    pactfileWriteMode: 'update'
  })

  const mockLogger = {
    info: vi.fn(),
    error: vi.fn()
  }

  it('should create an agreement offer when receiving an AWS SQS event from GAS', () => {
    mockCreateOffer.mockResolvedValue({
      agreementNumber: 'mockAgreementNumber'
    })

    return messagePact
      .given('agreement created event')
      .expectsToReceive('an agreement created message')
      .withContent({
        id: uuid('12345678-1234-1234-1234-123456789012'),
        source: like('fg-gas-backend'),
        time: iso8601DateTimeWithMillis('2025-12-15T10:19:06.519Z'),
        specversion: '1.0',
        type: 'cloud.defra.test.fg-gas-backend.agreement.create',
        datacontenttype: 'application/json',
        data: like(mockAgreement)
      })
      .verify(async (message) => {
        await handleCreateAgreementEvent(
          message.contents.id,
          message.contents,
          mockLogger
        )

        expect(mockLogger.info).toHaveBeenNthCalledWith(
          1,
          'Creating agreement from event: 12345678-1234-1234-1234-123456789012'
        )
        expect(mockLogger.info).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining(
            'Full incoming message payload (as received):'
          )
        )
        expect(mockLogger.info).toHaveBeenNthCalledWith(
          3,
          'Agreement created: mockAgreementNumber'
        )
        expect(mockCreateOffer).toHaveBeenCalledWith(
          '12345678-1234-1234-1234-123456789012',
          mockAgreement,
          mockLogger
        )
      })
  })
})
