import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { config } from '#~/config/index.js'
import { v4 as uuidv4 } from 'uuid'
import { getSqsClient } from './sqs-client.js'

// Initialize client for LocalStack
export const getClient = () =>
  getSqsClient({
    awsRegion: config.get('aws.region'),
    sqsEndpoint: config.get('sqs.endpoint')
  })

const sqsClient = getClient()

/**
 * Sends a message to an SQS FIFO Queue with retries and exponential backoff.
 */
export async function sendMessage({ queueUrl, type, data }, logger) {
  const messageBody = {
    id: uuidv4(),
    source: config.get('sqs.eventSource'),
    type,
    time: new Date().toISOString(),
    data
  }

  logger?.info?.(
    `Publishing event to SQS with data: ${JSON.stringify(messageBody, null, 2)}`
  )

  try {
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(messageBody),
        // Required for FIFO queues
        MessageGroupId: config.get('serviceName'),
        MessageDeduplicationId: uuidv4()
      })
    )

    logger?.info?.(
      `Sent message to SQS queue: ${queueUrl} type: ${type} id: ${messageBody.id}`
    )
  } catch (error) {
    logger?.error?.(
      {
        error: error.message,
        code: error.name
      },
      `Failed to send message to SQS: ${queueUrl}.
       The Error name: ${error.name} and Error message: ${error.message}`
    )
    throw error
  }
}
