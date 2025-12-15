import Boom, { isBoom } from '@hapi/boom'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { config } from '~/src/config/index.js'

const maxDelay = 8000

const checkAgreementWithBackoff = async (sbi, delay, logger) => {
  if (delay > maxDelay) {
    throw Boom.internal(
      `Failed to retrieve agreement data after multiple attempts for SBI: ${sbi}`
    )
  }

  // Attempt to get the agreement data
  try {
    return await getAgreementData({ sbi })
  } catch (error) {
    logger.error(error, `Failed to retrieve agreement data for SBI: ${sbi}`)
    if (isBoom(error) && error.output.statusCode === statusCodes.notFound) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      return checkAgreementWithBackoff(sbi, delay * 2, logger)
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

      if (!queueMessage) {
        throw Boom.internal('Queue message data is required')
      }

      const { queueName = 'create_agreement' } = request.params
      const baseQueueUrl = config.get('sqs.queueUrl').split('/')
      baseQueueUrl.pop()
      const queueUrl = `${baseQueueUrl.join('/')}/${queueName}`

      request.logger.info(
        `Posting test queue message in: "${queueUrl}" with data: ${JSON.stringify(queueMessage)}`
      )

      const sqsClient = new SQSClient({
        region: config.get('aws.region'),
        endpoint: config.get('sqs.endpoint')
      })

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(queueMessage)
      })

      await sqsClient.send(command)

      let agreementData
      if (queueName === 'create_agreement') {
        // Get the agreement from the database by SBI
        agreementData = await checkAgreementWithBackoff(
          queueMessage.data.identifiers.sbi,
          1000,
          request.logger
        )
      }

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

      request.logger.error(error, `Error posting test queue message`)
      return h
        .response({
          message: 'Failed to post test queue message',
          error
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { postTestQueueMessageController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
