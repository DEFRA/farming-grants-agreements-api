import Boom from '@hapi/boom'
import { SQSClient } from '@aws-sdk/client-sqs'
import { Consumer } from 'sqs-consumer'
import { config } from '~/src/config/index.js'
import { createAgreement } from '~/src/api/agreement/helpers/create-agreement.js'

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
    const agreement = await createAgreement(payload.data)
    logger.info(`Agreement created: ${JSON.stringify(agreement)}`)
    return agreement
  }

  return Promise.reject(new Error('Unrecognized event type'))
}

/**
 * Process a message from the SQS queue
 * @param { Message } message - The message to process
 * @param { import('@hapi/hapi').Server } logger - The logger instance
 * @returns {Promise<void>}
 */
export const processMessage = async (message, logger) => {
  try {
    const messageBody = JSON.parse(message.Body)
    await handleEvent(messageBody, logger)
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

      const app = Consumer.create({
        queueUrl: options.queueUrl,
        handleMessage: async (message) => {
          try {
            await processMessage(message, server.logger)
            server.logger.info(
              `Successfully processed message: ${message.MessageId}`
            )
          } catch (error) {
            server.logger.error('Failed to process message:', {
              messageId: message.MessageId,
              error: error.message,
              stack: error.stack,
              data: error.data
            })
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

      app.on('error', (err) => {
        server.logger.error('SQS Consumer error:', {
          error: err.message,
          stack: err.stack
        })
      })

      app.on('processing_error', (err) => {
        server.logger.error('SQS Message processing error:', {
          error: err.message,
          stack: err.stack
        })
      })

      app.start()

      server.events.on('stop', () => {
        server.logger.info('Stopping SQS consumer')
        app.stop()
        server.logger.info('Closing SQS client')
        sqsClient.destroy()
      })
    }
  },
  options: {
    awsRegion: config.get('aws.region'),
    sqsEndpoint: config.get('sqs.endpoint'),
    queueUrl: config.get('sqs.queueUrl')
  }
}

/**
 * @import { Agreement } from '~/src/api/common/types/agreement.d.js'
 * @import { Message } from '@aws-sdk/client-sqs'
 */
