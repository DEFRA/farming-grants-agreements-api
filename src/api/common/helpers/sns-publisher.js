import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { v4 as uuidv4 } from 'uuid'
import { config } from '~/src/config/index.js'

const snsClient = new SNSClient({
  region: config.get('aws.region'),
  endpoint: config.get('aws.sns.endpoint'),
  credentials: {
    accessKeyId: config.get('aws.accessKeyId'),
    secretAccessKey: config.get('aws.secretAccessKey')
  }
})

/**
 * Publish an SNS message with basic retry on transient errors
 * @param {object} params
 * @param {string} params.topicArn - SNS Topic ARN
 * @param {string} params.type - CloudEvent type
 * @param {string} params.time - ISO timestamp
 * @param {object} params.data - Event payload
 * @param {object} logger - Logger with info/error methods
 * @param {object} client - SNS client optional for testing
 * @returns {Promise<void>}
 */
export async function publishEvent(
  { topicArn, type, time, data },
  logger,
  client = snsClient
) {
  const message = {
    id: uuidv4(),
    source: config.get('aws.sns.eventSource'),
    specversion: '1.0',
    type,
    time,
    datacontenttype: 'application/json',
    data
  }

  const maxAttempts = 3
  let attempt = 0
  let lastError

  while (attempt < maxAttempts) {
    try {
      await client.send(
        new PublishCommand({
          TopicArn: topicArn,
          Message: JSON.stringify(message)
        })
      )
      logger?.info?.(
        `Published event to SNS topic: ${topicArn} type: ${type} id: ${message.id}`
      )
      return
    } catch (error) {
      lastError = error
      const isRetryable =
        error?.$metadata?.httpStatusCode >= 500 ||
        error?.name === 'ThrottlingException' ||
        error?.name === 'TimeoutError' ||
        error?.name === 'NetworkingError'

      logger?.error?.('Failed to publish event to SNS', {
        attempt: attempt + 1,
        maxAttempts,
        error: error?.message,
        code: error?.name,
        stack: error?.stack
      })

      if (!isRetryable || attempt === maxAttempts - 1) {
        break
      }

      // exponential backoff
      const backoffMs = Math.min(1000 * 2 ** attempt, 5000)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
      attempt += 1
    }
  }

  throw lastError
}
