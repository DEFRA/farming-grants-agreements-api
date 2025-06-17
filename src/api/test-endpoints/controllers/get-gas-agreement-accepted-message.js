import Boom from '@hapi/boom'
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { config } from '~/src/config/index.js'

// In-memory event store for test purposes
const events = []

async function drainQueue(queueUrl, sqsClient) {
  const drained = []
  while (true) {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 1
    })
    const result = await sqsClient.send(command)
    if (!result.Messages || result.Messages.length === 0) break
    for (const msg of result.Messages) {
      try {
        const body = JSON.parse(msg.Body)
        drained.push(body)
      } catch (e) {}
      // Always delete the message so the queue is truly drained
      await sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: msg.ReceiptHandle
        })
      )
    }
  }
  return drained
}

/**
 * GET /api/test/gas-agreement-accepted-message?agreementId=...
 * Drains the queue if the requested agreementId is not found in memory.
 * @satisfies {Partial<ServerRoute>}
 */
const getGasAgreementAcceptedMessageController = {
  handler: async (request, h) => {
    const agreementId = request.query.agreementId
    if (!agreementId) {
      throw Boom.badRequest('Missing agreementId query parameter')
    }
    let found = events.find((e) => e.agreementId === agreementId)
    if (!found) {
      // Drain the queue if not found in memory
      const sqsClient = new SQSClient({
        region: config.get('aws.region'),
        endpoint: config.get('sqs.endpoint')
      })
      const queueUrl =
        'http://localstack:4566/000000000000/gas_agreement_accepted'
      const drained = await drainQueue(queueUrl, sqsClient)
      events.push(...drained)
      found = events.find((e) => e.agreementId === agreementId)
    }
    if (!found) {
      throw Boom.notFound('No message found for the specified agreementId.')
    }
    return h
      .response({ message: 'Message received', event: found })
      .code(statusCodes.ok)
  }
}

export { getGasAgreementAcceptedMessageController }
