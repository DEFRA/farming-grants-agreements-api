import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { config } from '~/src/config/index.js'
import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Publish a message to an SNS topic
 * @param {object} message - The message to publish
 * @param {import('@hapi/hapi').Server} server - The server instance
 * @returns {Promise<void>}
 */
export const publishMessage = async (message, server) => {
  try {
    if (!server.app?.snsClient) {
      throw new Error('SNS client not initialized')
    }

    const topicArn = config.get('sns.topicArn')
    server.logger.info('Preparing to publish message to SNS', {
      topicArn,
      message
    })

    const command = new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message)
    })

    server.logger.info('Sending message to SNS', {
      command: {
        TopicArn: topicArn,
        Message: JSON.stringify(message)
      }
    })

    await server.app.snsClient.send(command)
    server.logger.info('Message published successfully to SNS', {
      topicArn
    })
  } catch (error) {
    server.logger.error('Error publishing message to SNS:', {
      message,
      error: error.message,
      stack: error.stack,
      topicArn: config.get('sns.topicArn')
    })
    throw Boom.boomify(error, {
      statusCode: statusCodes.internalServerError,
      message: 'Error publishing SNS message',
      data: {
        message,
        originalError: error.message
      }
    })
  }
}

/**
 * Hapi plugin for SNS message publishing
 * @type {import('@hapi/hapi').Plugin<{
 *   awsRegion: string,
 *   snsEndpoint: string,
 *   topicArn: string
 * }>}
 */
export const snsPublisherPlugin = {
  plugin: {
    name: 'sns',
    version: '1.0.0',
    /**
     * @param {import('@hapi/hapi').Server} server
     * @param {{ awsRegion: string, snsEndpoint: string, topicArn: string }} options
     * @returns {void}
     */
    register: function (server, options) {
      server.logger.info('Setting up SNS client')

      const snsClient = new SNSClient({
        region: options.awsRegion,
        endpoint: options.snsEndpoint
      })

      // Expose the SNS client to the server
      server.app.snsClient = snsClient

      server.events.on('stop', () => {
        server.logger.info('Closing SNS client')
        snsClient.destroy()
      })
    }
  },
  options: {
    awsRegion: config.get('aws.region'),
    snsEndpoint: config.get('sns.endpoint'),
    topicArn: config.get('sns.topicArn')
  }
}

/**
 * @import { Message } from '@aws-sdk/client-sns'
 */
