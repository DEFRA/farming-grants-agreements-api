import { SQSClient } from '@aws-sdk/client-sqs'
import Boom from '@hapi/boom'
import { Consumer } from 'sqs-consumer'
import { config } from '~/src/config/index.js'

/**
 * Process a message from the SQS queue
 * @param {Function} callback - The function to handle the message
 * @param { Message } message - The message to process
 * @param { import('@hapi/hapi').Server } logger - The logger instance
 * @returns {Promise<void>}
 */
export const processMessage = async (callback, message, logger) => {
  try {
    const messageBody = JSON.parse(message.Body)
    await callback(message.MessageId, messageBody, logger)
  } catch (error) {
    logger.error(
      {
        message,
        error: error.message,
        stack: error.stack
      },
      'Error processing message:'
    )

    if (error.name === 'SyntaxError') {
      throw Boom.badData('Invalid message format', {
        message,
        error: error.message
      })
    }

    throw Boom.badImplementation('Error processing SQS message', error)
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
export const createSqsClientPlugin = (tag, queueUrl, callback) => ({
  plugin: {
    name: `sqs-client-${tag}`,
    version: '1.0.0',
    /**
     *
     * @param { import('@hapi/hapi').Server } server
     * @param { { awsRegion: string, sqsEndpoint: string, queueUrl: string } } options
     * @returns {void}
     */
    register: function (server, options) {
      server.logger.info(`Setting up SQS client (${tag})`)

      const sqsClient = new SQSClient({
        region: options.awsRegion,
        endpoint: options.sqsEndpoint
      })

      const sqsConsumer = Consumer.create({
        queueUrl: options.queueUrl,
        handleMessage: async (message) => {
          try {
            await processMessage(callback, message, server.logger)
            server.logger.info(
              `Successfully processed SQS (${tag}) message: ${message.MessageId}`
            )
          } catch (error) {
            server.logger.error(
              {
                messageId: message.MessageId,
                error: error.message,
                stack: error.stack,
                data: error.data
              },
              `Failed to process SQS (${tag}) message:`
            )
          }
        },
        sqs: sqsClient,
        batchSize: config.get('sqs.maxMessages'),
        waitTimeSeconds: config.get('sqs.waitTime'),
        visibilityTimeout: config.get('sqs.visibilityTimeout'),
        handleMessageTimeout: 30000, // 30 seconds timeout for message processing
        attributeNames: ['All'],
        messageAttributeNames: ['All']
      })

      sqsConsumer.on('error', (err) => {
        server.logger.error(
          {
            error: err.message || err.toString(),
            fullError: err
          },
          `SQS Consumer (${tag}) error:`
        )
      })

      sqsConsumer.on('processing_error', (err) => {
        server.logger.error(
          {
            error: err.message,
            stack: err.stack
          },
          `SQS Message (${tag}) processing error:`
        )
      })

      sqsConsumer.on('started', () => {
        server.logger.info(`SQS Consumer (${tag}) started`)
      })

      sqsConsumer.start()

      server.events.on('stop', () => {
        server.logger.info(`Stopping SQS consumer (${tag})`)
        sqsConsumer.stop()
        server.logger.info(`Closing SQS client (${tag})`)
        sqsClient.destroy()
      })
    }
  },
  options: {
    awsRegion: config.get('aws.region'),
    sqsEndpoint: config.get('sqs.endpoint'),
    queueUrl
  }
})

/**
 * @import { Agreement } from '~/src/api/common/types/agreement.d.js'
 * @import { Message } from '@aws-sdk/client-sqs'
 */
