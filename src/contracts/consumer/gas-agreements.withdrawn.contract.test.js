import path from 'node:path'

import { MatchersV2, MessageConsumerPact } from '@pact-foundation/pact'

import { handleUpdateAgreementEvent } from '~/src/api/common/helpers/sqs-message-processor/update-agreement.js'
import { withdrawOffer as mockWithdrawOffer } from '~/src/api/agreement/helpers/withdraw-offer.js'

jest.mock('~/src/api/agreement/helpers/withdraw-offer.js')
jest.mock('~/src/api/common/helpers/sns-publisher.js')

const { like } = MatchersV2

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
          agreementNumber: like('SFI123456789'),
          status: like('withdrawn')
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
        expect(mockWithdrawOffer).toHaveBeenCalledWith(
          'client-ref-002',
          'SFI123456789'
        )
      })
  })
})
