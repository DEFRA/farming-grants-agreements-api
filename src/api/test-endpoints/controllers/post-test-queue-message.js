import Boom from '@hapi/boom'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { config } from '~/src/config/index.js'

/**
 * Controller to post a test queue message
 * @satisfies {Partial<ServerRoute>}
 */
const postTestQueueMessageController = {
  handler: async (request, h) => {
    try {
      const queueMessage = request.payload

      request.logger.info(
        `Posting test queue message with data: ${JSON.stringify(queueMessage)}`
      )

      if (!queueMessage) {
        throw Boom.internal('Queue message data is required')
      }

      const sqsClient = new SQSClient({
        region: config.get('aws.region'),
        credentials: {
          accessKeyId: config.get('aws.accessKeyId'),
          secretAccessKey: config.get('aws.secretAccessKey')
        }
      })

      const command = new SendMessageCommand({
        QueueUrl: config.get('sqs.queueUrl'),
        MessageBody: JSON.stringify(queueMessage)
      })

      await sqsClient.send(command)

      // Get the agreement from the database by SBI and FRN
      const agreementData = await getAgreementData({
        sbi: queueMessage.data.identifiers.sbi,
        frn: queueMessage.data.identifiers.frn
      })

      return h
        .response({
          message: 'Test queue message posted',
          agreementData
        })
        .code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(`Error posting test queue message: ${error}`)
      return h
        .response({
          message: 'Failed to post test queue message',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { postTestQueueMessageController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
