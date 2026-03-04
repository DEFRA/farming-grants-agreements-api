import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { config } from '#~/config/index.js'
import { v4 as uuidv4 } from 'uuid'
import { getSqsClient } from './sqs-client.js'

// Initialize client for LocalStack
const sqsClient = getSqsClient({
  awsRegion: config.get('aws.region'),
  sqsEndpoint: config.get('sqs.endpoint')
})

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

  // const maxAttempts = config.get('aws.sqs.maxAttempts') ?? 3
  // let attempt = 0
  let lastError

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
    return
  } catch (error) {
    lastError = error

    // Determine if error is retryable (5xx or specific network errors)
    // const isRetryable =
    //   error?.$metadata?.httpStatusCode >= 500 ||
    //   ['ThrottlingException', 'TimeoutError', 'NetworkingError'].includes(
    //     error.name
    //   )

    logger?.error?.(
      {
        // attempt: attempt + 1,
        error: error.message,
        code: error.name
      },
      `Failed to send message to SQS: ${queueUrl}`
    )
    // if (!isRetryable || attempt === maxAttempts - 1) break
    // Exponential backoff
    // const backoffMs = Math.min(1000 * 2 ** 1, 5000)
    // await new Promise((resolve) => setTimeout(resolve, backoffMs))
    // attempt += 1
  }
  // }

  throw lastError
}
