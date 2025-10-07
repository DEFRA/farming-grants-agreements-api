import path from 'node:path'

import { MessageProviderPact } from '@pact-foundation/pact'

import { publishEvent as mockPublishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { withdrawOffer as mockWithdrawOffer } from '~/src/api/agreement/helpers/withdraw-offer.js'
import { handleUpdateAgreementEvent } from '~/src/api/common/helpers/sqs-message-processor/update-agreement.js'

jest.mock('~/src/api/common/helpers/sns-publisher.js')
jest.mock('~/src/api/agreement/helpers/withdraw-offer.js')

describe('sending updated (withdrawn) events via SNS', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
  }

  const messagePact = new MessageProviderPact({
    messageProviders: {
      'agreement withdrawn': async () => {
        let message
        try {
          mockPublishEvent.mockResolvedValue()

          mockWithdrawOffer.mockResolvedValue({
            agreement: { agreementNumber: 'SFI123456789' },
            clientRef: 'mockClientRef',
            code: 'mockCode',
            correlationId: 'mockCorrelationId',
            status: 'withdrawn'
          })

          await handleUpdateAgreementEvent(
            '123-456-789',
            {
              id: '12-34-56-78-90',
              source: 'fg-gas-backend',
              specVersion: '1.0',
              type: 'cloud.defra.test.fg-gas-backend.agreement.withdraw',
              datacontenttype: 'application/json',
              data: {
                clientRef: 'client-ref-001',
                id: '123e4567-e89b-12d3-a456-426614174000',
                status: 'PRE_AWARD:APPLICATION:APPLICATION_WITHDRAWN',
                withdrawnBy: 'Caseworker_ID_123',
                withdrawnAt: '2025-03-27T14:30:00Z'
              }
            },
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
    },
    provider: 'sns-agreements:agreement_status_updated',
    consumer: 'sqs-gas',
    providerVersion: '1.0.0',
    pactUrls: [
      path.resolve(
        'src',
        'contracts',
        'pacts',
        'sns-agreements:agreement_status_updated:withdrawn.json'
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
