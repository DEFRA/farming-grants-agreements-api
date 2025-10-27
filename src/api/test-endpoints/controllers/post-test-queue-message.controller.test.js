// Mock AWS SQS with proper constructor BEFORE importing module under test
import Boom from '@hapi/boom'
import { postTestQueueMessageController } from './post-test-queue-message.controller.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { __mockSend as sendMock } from '@aws-sdk/client-sqs'

jest.mock('@aws-sdk/client-sqs', () => {
  const mockSend = jest.fn()
  return {
    SQSClient: jest.fn().mockImplementation(() => ({
      send: mockSend
    })),
    SendMessageCommand: jest.fn().mockImplementation((input) => ({
      input
    })),
    __mockSend: mockSend // Export the mock for use in tests
  }
})

// Mock config BEFORE importing module under test
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

  test('returns 400 when controller hits Boom error from downstream', async () => {
    sendMock.mockResolvedValueOnce({})
    // Simulate Boom from getAgreementData
    getAgreementData.mockRejectedValueOnce(Boom.badRequest('bad payload'))

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: {} },
      h
    )
    expect(res.output.statusCode).toBe(400)
  })

  test('returns 500 on unexpected errors', async () => {
    sendMock.mockRejectedValueOnce(new Error('sqs down'))
    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: {} },
      h
    )
    expect(res.statusCode).toBe(500)
    expect(logger.error).toHaveBeenCalled()
  })

  test('validates payload presence', async () => {
    const err = await postTestQueueMessageController.handler(
      { payload: null, logger, params: {} },
      h
    )
    expect(Boom.isBoom(err)).toBe(true)
    expect(err.output.statusCode).toBe(500)
  })

  test('successfully posts message to default queue', async () => {
    sendMock.mockResolvedValueOnce({})

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: {} },
      h
    )

    expect(res.statusCode).toBe(statusCodes.ok)
    expect(res.payload.message).toBe('Test queue message posted')
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          QueueUrl: 'http://localhost:4566/000000000000/create_agreement',
          MessageBody: JSON.stringify(payload)
        })
      })
    )
  })

  test('successfully posts message to custom queue', async () => {
    sendMock.mockResolvedValueOnce({})

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: { queueName: 'custom-queue' } },
      h
    )

    expect(res.statusCode).toBe(statusCodes.ok)
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          QueueUrl: 'http://localhost:4566/000000000000/custom-queue',
          MessageBody: JSON.stringify(payload)
        })
      })
    )
  })

  test('retrieves agreement data for create_agreement queue', async () => {
    const mockAgreementData = {
      _id: 'agreement123',
      agreementNumber: 'SFI123',
      status: 'offered'
    }

    sendMock.mockResolvedValueOnce({})
    getAgreementData.mockResolvedValueOnce(mockAgreementData)

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: { queueName: 'create_agreement' } },
      h
    )

    expect(res.statusCode).toBe(statusCodes.ok)
    expect(res.payload.agreementData).toEqual(mockAgreementData)
    expect(getAgreementData).toHaveBeenCalledWith({
      sbi: '123456789',
      frn: '9999999999'
    })
  })

  test('does not retrieve agreement data for non-create_agreement queue', async () => {
    sendMock.mockResolvedValueOnce({})

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: { queueName: 'other-queue' } },
      h
    )

    expect(res.statusCode).toBe(statusCodes.ok)
    expect(res.payload.agreementData).toBeUndefined()
    expect(getAgreementData).not.toHaveBeenCalled()
  })

  test('handles backoff retry with 404 errors', async () => {
    const mockAgreementData = {
      _id: 'agreement123',
      agreementNumber: 'SFI123',
      status: 'offered'
    }

    sendMock.mockResolvedValueOnce({})
    // First call returns 404, second call succeeds
    getAgreementData
      .mockRejectedValueOnce(Boom.notFound('Not found'))
      .mockResolvedValueOnce(mockAgreementData)

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: { queueName: 'create_agreement' } },
      h
    )

    expect(res.statusCode).toBe(statusCodes.ok)
    expect(res.payload.agreementData).toEqual(mockAgreementData)
    expect(getAgreementData).toHaveBeenCalledTimes(2)
  })

  test('handles maximum delay exceeded in backoff', async () => {
    sendMock.mockResolvedValueOnce({})
    // Mock setTimeout to not actually wait
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => fn())

    // Mock getAgreementData to always return 404
    getAgreementData.mockRejectedValue(Boom.notFound('Not found'))

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: { queueName: 'create_agreement' } },
      h
    )

    expect(res).toEqual(
      new Error(
        'Failed to retrieve agreement data after multiple attempts for SBI: 123456789, FRN: 9999999999'
      )
    )

    // Restore setTimeout
    global.setTimeout.mockRestore()
  })

  test('handles non-Boom errors in backoff', async () => {
    sendMock.mockResolvedValueOnce({})
    getAgreementData.mockRejectedValueOnce(new Error('Database error'))

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: { queueName: 'create_agreement' } },
      h
    )

    expect(res.statusCode).toBe(statusCodes.internalServerError)
    expect(res.payload.message).toBe('Failed to post test queue message')
  })

  test('logs queue message posting', async () => {
    sendMock.mockResolvedValueOnce({})

    await postTestQueueMessageController.handler(
      { payload, logger, params: { queueName: 'test-queue' } },
      h
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Posting test queue message in: "http://localhost:4566/000000000000/test-queue"'
      )
    )
  })

  test('handles Boom errors correctly', async () => {
    const boomError = Boom.badRequest('Invalid request')
    sendMock.mockRejectedValueOnce(boomError)

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: {} },
      h
    )

    expect(res).toBe(boomError)
  })
})
