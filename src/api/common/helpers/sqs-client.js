import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs'
import Boom from '@hapi/boom'
import { config } from '~/src/config/index.js'
import { createAgreement } from '~/src/api/agreement/helpers/create-agreement.js'

/**
 * Checks for messages in the SQS queue
 * @param {SQSClient} sqsClient - AWS SQS client instance
 * @param {string} queueUrl - URL of the queue to check
 * @returns {Promise<ReceiveMessageCommandOutput>}
 */
export const checkMessages = (sqsClient, queueUrl) => {
  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: config.get('sqs.maxMessages'),
    WaitTimeSeconds: config.get('sqs.waitTime'),
    VisibilityTimeout: config.get('sqs.visibilityTimeout')
  })
  return sqsClient.send(command)
}

/**
 * Handle an event from the SQS queue
 * @param { Message } payload - The message payload
 * @param { import('@hapi/hapi').Server } logger - The logger instance
 * @returns {Promise<Agreement>}
 */
export const handleEvent = async (payload, logger) => {
  if (payload.type.indexOf('application.approved') !== -1) {
    logger.info(
      `Creating agreement from event: ${JSON.stringify(payload.data)}`
    )
    await createAgreement(payload.data)
  }
}

/**
 * Process a message from the SQS queue
 * @param { Message } message - The message to process
 * @param { import('@hapi/hapi').Server } logger - The logger instance
 * @returns {Promise<void>}
 */
export const processMessage = async (message, logger) => {
  try {
    const snsEnvelope = JSON.parse(message.Body)
    const eventPayload = JSON.parse(snsEnvelope.Message)
    await handleEvent(eventPayload, logger)
  } catch (err) {
    logger.error(`Error processing message`, message)
    throw Boom.internal('Error processing SQS message', {
      message: err.message,
      stack: err.stack
    })
  }
}

/**
 * Delete a message from the SQS queue
 * @param {SQSClient} sqsClient - AWS SQS client instance
 * @param {string} queueUrl - URL of the queue to delete from
 * @param {string} receiptHandle - Receipt handle of the message to delete
 * @returns {Promise<DeleteMessageCommandOutput>}
 */
export const deleteMessage = (sqsClient, queueUrl, receiptHandle) =>
  sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle
    })
  )

/**
 * Poll the SQS queue for messages
 * @param { import('@hapi/hapi').Server } logger - The logger instance
 * @param {SQSClient} sqsClient - AWS SQS client instance
 * @param {string} queueUrl - URL of the queue to poll
 * @returns {Promise<void>}
 */
export const pollMessages = async ({ logger }, sqsClient, queueUrl) => {
  const data = await checkMessages(sqsClient, queueUrl)

  if (data.Messages) {
    for (const msg of data.Messages) {
      await processMessage(msg, logger)
      await deleteMessage(sqsClient, queueUrl, msg.ReceiptHandle)
      logger.info(`Deleted message: ${msg.MessageId}`)
    }
  }
}

/**
 * Hapi plugin for SQS message processing
 * @type {import('@hapi/hapi').Plugin<{
 *   awsRegion: string,
 *   sqsEndpoint: string,
 *   queueUrl: string
 * }>}
 */
export const sqsClientPlugin = {
  plugin: {
    name: 'sqs',
    version: '1.0.0',
    /**
     *
     * @param { import('@hapi/hapi').Server } server
     * @param { { awsRegion: string, sqsEndpoint: string, queueUrl: string } } options
     * @returns {void}
     */
    register: function (server, options) {
      server.logger.info('Setting up SQS client')

      const sqsClient = new SQSClient({
        region: options.awsRegion,
        endpoint: options.sqsEndpoint
      })

      const intervalId = setInterval(() => {
        pollMessages(server, sqsClient, options.queueUrl).catch((err) => {
          server.logger.error('Unhandled SQS Client error:', {
            error: err.message
          })

          throw Boom.internal('Error processing SQS message', {
            message: err.message,
            stack: err.stack
          })
        })
      }, config.get('sqs.interval'))

      server.events.on('closing', () => {
        server.logger.info('Stopping SQS client polling')
        clearInterval(intervalId)
      })

      server.events.on('stop', () => {
        server.logger.info(`Closing SQS client`)
        sqsClient.destroy()
      })
    }
  },
  options: {
    awsRegion: config.get('sqs.awsRegion'),
    sqsEndpoint: config.get('sqs.endpoint'),
    queueUrl: config.get('sqs.queueUrl')
  }
}

/**
 * @import { Agreement } from '~/src/api/common/types/agreement.d.js'
 * @import { Message, DeleteMessageCommandOutput, ReceiveMessageCommandOutput } from '@aws-sdk/client-sqs'
 */
