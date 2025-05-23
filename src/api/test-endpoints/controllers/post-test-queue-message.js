import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
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

      // TODO: Implement the logic to post the test queue message
      const snsClient = new SNSClient({
        region: config.aws.region,
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey
        }
      })

      const command = new PublishCommand({
        TopicArn: config.aws.sns.topicArn,
        Message: JSON.stringify(queueMessage)
      })

      await snsClient.send(command)

      // Get the agreement from the database by SBI
      const agreementData = await getAgreementData({
        sbi: queueMessage.sbi
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
