import Boom, { isBoom } from '@hapi/boom'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { config } from '~/src/config/index.js'

const maxDelay = 8000

const checkAgreementWithBackoff = async (sbi, frn, delay) => {
  if (delay > maxDelay) {
    throw Boom.internal(
      `Failed to retrieve agreement data after multiple attempts for SBI: ${sbi}, FRN: ${frn}`
    )
  }

  // Attempt to get the agreement data
  try {
    return await getAgreementData({ sbi, frn })
  } catch (error) {
    if (isBoom(error) && error.output.statusCode === statusCodes.notFound) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      return checkAgreementWithBackoff(sbi, frn, delay * 2)
    }
    throw error
  }
}

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
        endpoint: config.get('sqs.endpoint')
      })

      const command = new SendMessageCommand({
        QueueUrl: config.get('sqs.queueUrl'),
        MessageBody: JSON.stringify(queueMessage)
      })

      await sqsClient.send(command)

      // Get the agreement from the database by SBI and FRN
      const agreementData = await checkAgreementWithBackoff(
        queueMessage.data.identifiers.sbi,
        queueMessage.data.identifiers.frn,
        1000
      )

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
