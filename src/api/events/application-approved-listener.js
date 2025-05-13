// src/api/events/application-approved-listener.js
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand
} from '@aws-sdk/client-sqs'
import { createLogger } from '~/src/api/common/helpers/logging/logger.js'
import { config } from '~/src/config/index.js'

const sqs = new SQSClient({
  region: config.get('awsRegion'),
  endpoint: 'sqs.eu-west-2.amazonaws.com',
  ...(config.get('isDevelopment') && {
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  })
})

const input = {
  QueueName: config.get('queueName'),
  QueueOwnerAWSAccountId: '332499610595'
}
const command = new GetQueueUrlCommand(input)
const response = await sqs.send(command)
const queueUrl = response.QueueUrl

const logger = createLogger()

function handleApplicationApproved(payload) {
  logger.info('Creating agreement from event:', { payload })
  // TODO: Call your real agreement creation here
  // Example (pseudo): await agreementService.createFromEvent(payload);
}

export function pollQueue() {
  logger.info('Starting ApplicationApproved listener (polling every 10s)...')
  const intervalId = setInterval(() => {
    pollMessages().catch((err) => {
      logger.error('Unhandled polling error:', { error: err.message })
    })
  }, 10000)

  async function pollMessages() {
    logger.info('Polling queue for messages...')
    try {
      const data = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 5,
          VisibilityTimeout: 10
        })
      )

      if (data.Messages) {
        for (const msg of data.Messages) {
          try {
            const snsEnvelope = JSON.parse(msg.Body)
            const eventPayload = JSON.parse(snsEnvelope.Message)
            logger.info(
              `Received event: ${JSON.stringify(eventPayload, null, 2)}`
            )

            handleApplicationApproved(eventPayload)

            await sqs.send(
              new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: msg.ReceiptHandle
              })
            )
            logger.info('Message deleted.')
          } catch (err) {
            logger.error('Error processing message:', { error: err })
          }
        }
      } else {
        logger.info('No messages.')
      }
    } catch (err) {
      logger.error('SQS Polling error (e.g., queue missing?):', {
        error: err.message
      })
    }
  }

  return intervalId
}
