import path from 'node:path'

import { MessageConsumerPact, MatchersV2 } from '@pact-foundation/pact'

import { handleUpdateAgreementEvent } from '~/src/api/common/helpers/sqs-message-processor/update-agreement.js'
import { withdrawOffer as mockWithdrawOffer } from '~/src/api/agreement/helpers/withdraw-offer.js'

jest.mock('~/src/api/agreement/helpers/withdraw-offer.js')
jest.mock('~/src/api/common/helpers/sns-publisher.js')

const { like, iso8601DateTime } = MatchersV2

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

  it('should withdraw an agreement offer when receiving an AWS SQS event from GAS', () => {
    mockWithdrawOffer.mockResolvedValue({
      agreement: {
        agreementNumber: 'mockAgreementNumber'
      }
    })

    return messagePact
      .given('agreement offer withdrawn event')
      .expectsToReceive('an agreement withdrawn message')
      .withContent({
        id: like('12-34-56-78-90'),
        source: like('fg-gas-backend'),
        specVersion: '1.0',
        type: 'cloud.defra.test.fg-gas-backend.agreement.withdraw',
        datacontenttype: 'application/json',
        data: {
          clientRef: like('client-ref-002'),
          id: like('123e4567-e89b-12d3-a456-426614174000'),
          status: like('PRE_AWARD:APPLICATION:WITHDRAWAL_REQUESTED'),
          withdrawnBy: like('Caseworker_ID_123'),
          withdrawnAt: iso8601DateTime('2025-03-27T14:30:00Z')
        }
      })
      .verify(async (message) => {
        await handleUpdateAgreementEvent(
          message.contents.id,
          message.contents,
          mockLogger
        )

        expect(mockLogger.info).toHaveBeenNthCalledWith(
          1,
          'Received application withdrawn from event: 12-34-56-78-90'
        )
        expect(mockLogger.info).toHaveBeenNthCalledWith(
          2,
          'Offer withdrawn: mockAgreementNumber'
        )
        expect(mockWithdrawOffer).toHaveBeenCalledWith('client-ref-002')
      })
  })
})
