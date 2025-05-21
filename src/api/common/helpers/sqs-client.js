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
  } catch (error) {
    logger.error('Error processing message:', {
      message,
      error: error.message,
      stack: error.stack
    })

    if (error.name === 'SyntaxError') {
      throw Boom.badData('Invalid message format', {
        message,
        error: error.message
      })
    }

    throw Boom.boomify(error, {
      statusCode: 500,
      message: 'Error processing SQS message',
      data: {
        message,
        originalError: error.message
      }
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
 * Process a single message from the queue
 * @param {Message} msg - The message to process
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @param {SQSClient} sqsClient - AWS SQS client instance
 * @param {string} queueUrl - URL of the queue
 * @returns {Promise<void>}
 */
const processQueueMessage = async (msg, logger, sqsClient, queueUrl) => {
  try {
    await processMessage(msg, logger)
    await deleteMessage(sqsClient, queueUrl, msg.ReceiptHandle)
    logger.info(`Succesfully processed and deleted message: ${msg.MessageId}`)
  } catch (error) {
    logger.error('Failed to process message:', {
      messageId: msg.MessageId,
      error: error.message,
      stack: error.stack,
      data: error.data
    })
  }
}

/**
 * Poll the SQS queue for messages
 * @param { import('@hapi/hapi').Server } logger - The logger instance
 * @param {SQSClient} sqsClient - AWS SQS client instance
 * @param {string} queueUrl - URL of the queue to poll
 * @returns {Promise<void>}
 */
export const pollMessages = async ({ logger }, sqsClient, queueUrl) => {
  try {
    const data = await checkMessages(sqsClient, queueUrl)
    if (!data.Messages) {
      return
    }

    await Promise.all(
      data.Messages.map((msg) =>
        processQueueMessage(msg, logger, sqsClient, queueUrl)
      )
    )
  } catch (error) {
    logger.error('SQS Polling error:', {
      error: error.message,
      stack: error.stack
    })

    throw Boom.serverUnavailable('SQS queue unavailable', {
      error: error.message,
      queueUrl
    })
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
        pollMessages(server, sqsClient, options.queueUrl).catch((error) => {
          if (!error.isBoom) {
            server.logger.error('Unexpected SQS Client error:', {
              error: error.message,
              stack: error.stack
            })
          }

          throw error
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
