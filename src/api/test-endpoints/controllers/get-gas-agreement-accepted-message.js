import Boom from '@hapi/boom'
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { config } from '~/src/config/index.js'

/**
 * GET /api/test/gas-agreement-accepted-message
 * Receives a message from the gas_agreement_accepted SQS queue
 * @satisfies {Partial<ServerRoute>}
 */
const getGasAgreementAcceptedMessageController = {
  handler: async (request, h) => {
    try {
      const sqsClient = new SQSClient({
        region: config.get('aws.region'),
        endpoint: config.get('sqs.endpoint')
      })
      const queueUrl =
        'http://localstack:4566/000000000000/gas_agreement_accepted'
      const command = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 2
      })
      const result = await sqsClient.send(command)
      if (!result.Messages || result.Messages.length === 0) {
        throw Boom.notFound(
          'No messages found in gas_agreement_accepted queue.'
        )
      }
      const message = result.Messages[0]
      // Optionally delete the message after receiving
      await sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle
        })
      )
      return h
        .response({ message: 'Message received', body: message.Body })
        .code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }
      request.logger?.error?.(
        `Error receiving message from gas_agreement_accepted queue: ${error}`
      )
      return h
        .response({
          message:
            'Failed to receive message from gas_agreement_accepted queue',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { getGasAgreementAcceptedMessageController }
