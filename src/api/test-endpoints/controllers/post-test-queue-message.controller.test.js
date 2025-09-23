// Mock config BEFORE importing module under test
import Boom from '@hapi/boom'
import { postTestQueueMessageController } from './post-test-queue-message.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'

jest.mock('~/src/config/index.js', () => ({
  config: {
    get: jest.fn((key) => {
      if (key === 'aws.region') return 'eu-west-2'
      if (key === 'sqs.endpoint') return 'http://localhost:4566'
      if (key === 'sqs.queueUrl')
        return 'http://localhost:4566/000000000000/test-queue'
      return undefined
    })
  }
}))

// Mock AWS SQS
const sendMock = jest.fn()
class MockSQSClient {
  send = sendMock
}
class MockSendMessageCommand {
  constructor(input) {
    this.input = input
  }
}
jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: MockSQSClient,
  SendMessageCommand: MockSendMessageCommand
}))

// Mock agreement helper and backoff behavior
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  getAgreementData: jest.fn()
}))

describe('postTestQueueMessageController', () => {
  const h = {
    response: jest.fn((payload) => ({
      code: jest.fn((status) => ({ payload, statusCode: status }))
    }))
  }
  const logger = { info: jest.fn(), error: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const payload = {
    data: { identifiers: { sbi: '123456789', frn: '9999999999' } }
  }

  test('returns 500 when controller hits Boom error from downstream', async () => {
    sendMock.mockResolvedValueOnce({})
    // Simulate Boom from getAgreementData
    getAgreementData.mockRejectedValueOnce(Boom.badRequest('bad payload'))

    const res = await postTestQueueMessageController.handler(
      { payload, logger },
      h
    )
    expect(res.statusCode).toBe(500)
  })

  test('returns 500 on unexpected errors', async () => {
    sendMock.mockRejectedValueOnce(new Error('sqs down'))
    const res = await postTestQueueMessageController.handler(
      { payload, logger },
      h
    )
    expect(res.statusCode).toBe(500)
    expect(logger.error).toHaveBeenCalled()
  })

  test('validates payload presence', async () => {
    const err = await postTestQueueMessageController.handler(
      { payload: null, logger },
      h
    )
    expect(Boom.isBoom(err)).toBe(true)
    expect(err.output.statusCode).toBe(500)
  })
})
