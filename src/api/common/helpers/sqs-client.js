import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs'
import { config } from '~/src/config/index.js'
import { createAgreement } from '~/src/api/agreement/helpers/create-agreement.js'

export const handleEvent = async (payload, logger) => {
  if (payload.type.indexOf('application-approved') !== -1) {
    logger.info(
      `Creating agreement from event: ${JSON.stringify(payload.data)}`
    )
    await createAgreement(payload.data)
  }
}

export const processMessage = async (message, logger) => {
  const snsEnvelope = JSON.parse(message.Body)
  const eventPayload = JSON.parse(snsEnvelope.Message)
  await handleEvent(eventPayload, logger)
}

export const deleteMessage = async (sqsClient, queueUrl, receiptHandle) =>
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle
    })
  )

export const pollMessages = async ({ logger }, sqsClient, queueUrl) => {
  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 5,
    VisibilityTimeout: 10
  })

  const data = await sqsClient.send(command)

  if (data.Messages) {
    for (const msg of data.Messages) {
      await processMessage(msg, logger)
      await deleteMessage(sqsClient, queueUrl, msg.ReceiptHandle)
      logger.info(`Deleted message: ${msg.MessageId}`)
    }
  }
}

/**
 * @satisfies { import('@hapi/hapi').ServerRegisterPluginObject<*> }
 */
export const sqsClientPlugin = {
  plugin: {
    name: 'sqs',
    version: '1.0.0',
    /**
     *
     * @param { import('@hapi/hapi').Server } server
     * @param { { awsRegion: string, sqsEndpoint: string, queueName: string,queueUrl: string } } options
     * @returns {void}
     */
    register: function (server, options) {
      server.logger.info('Setting up SQS client')

      const sqsClient = new SQSClient({
        region: options.awsRegion,
        endpoint: options.sqsEndpoint
      })

      server.decorate('server', 'sqsClient', sqsClient)

      const intervalId = setInterval(() => {
        pollMessages(server, sqsClient, options.queueUrl).catch((err) => {
          server.logger.error('Unhandled SQS Client error:', {
            error: err.message
          })
        })
      }, config.get('sqsInterval'))

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
    awsRegion: config.get('awsRegion'),
    sqsEndpoint: config.get('sqsEndpoint'),
    queueName: config.get('queueName'),
    queueUrl: config.get('queueUrl')
  }
}

/**
 * To be mixed in with Request|Server to provide the db decorator
 * @typedef {{connection: import('mongoose').connection }} MongoosePlugin
 */
