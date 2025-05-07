// src/api/events/application-approved-listener.js
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand
} from '@aws-sdk/client-sqs'
import { createLogger } from '~/src/api/common/helpers/logging/logger.js'

const REGION = process.env.AWS_REGION || 'us-east-1'
const ENDPOINT = process.env.AWS_ENDPOINT || 'http://localstack:4566'
const QUEUE_URL =
  process.env.QUEUE_URL ||
  'http://localstack:4566/000000000000/application-approved-queue'

const sqs = new SQSClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
})

const logger = createLogger()

function handleApplicationApproved(payload) {
  logger.info('Creating agreement from event:', { payload })
  // TODO: Call your real agreement creation here
  // Example (pseudo): await agreementService.createFromEvent(payload);
}

async function verifyQueue() {
  try {
    await sqs.send(
      new GetQueueAttributesCommand({
        QueueUrl: QUEUE_URL,
        AttributeNames: ['All']
      })
    )
    logger.info('Queue verified and reachable.')
  } catch (err) {
    logger.warn('Queue not found or not ready:', { error: err.message })
  }
}

export async function pollQueue() {
  logger.info('Starting ApplicationApproved listener (polling every 10s)...')

  await verifyQueue()

  const intervalId = setInterval(async () => {
    logger.info('Polling queue for messages...')
    try {
      const data = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
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
                QueueUrl: QUEUE_URL,
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
  }, 10000)

  return intervalId
}
