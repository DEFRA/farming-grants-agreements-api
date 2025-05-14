// src/api/events/application-approved-listener.js
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand
} from '@aws-sdk/client-sqs'
import { createLogger } from '~/src/api/common/helpers/logging/logger.js'
import { config } from '~/src/config/index.js'
import { createAgreement } from '~/src/api/agreement/helpers/create-agreement.js'

const sqsClient = new SQSClient({
  region: config.get('awsRegion'),
  endpoint: config.get('awsEndpoint')
})

const logger = createLogger()

async function handleApplicationApproved(payload) {
  logger.info('Creating agreement from event:', { payload })
  try {
    await createAgreement(payload)
    logger.info('Agreement created successfully.')
  } catch (error) {
    logger.error('Failed to create agreement from event:', {
      error: error.message
    })
  }
}

export async function pollQueue() {
  logger.info('Starting ApplicationApproved listener (polling every 10s)...')

  const command = new GetQueueUrlCommand(config.get('queueName'))
  const queueUrl = await sqsClient.send(command)
  logger.info('Queue URL: ', queueUrl)
  const intervalId = setInterval(() => {
    pollMessages().catch((err) => {
      logger.error('Unhandled polling error:', { error: err.message })
    })
  }, config.get('sqsTimeout'))

  async function pollMessages() {
    logger.info('Polling queue for messages...')
    try {
      const data = await sqsClient.send(
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

            await handleApplicationApproved(eventPayload)

            await sqsClient.send(
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
