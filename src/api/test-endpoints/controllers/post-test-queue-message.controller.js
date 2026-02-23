import Boom, { isBoom } from '@hapi/boom'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { statusCodes } from '#~/api/common/constants/status-codes.js'
import { getAgreementData } from '#~/api/agreement/helpers/get-agreement-data.js'
import { config } from '#~/config/index.js'

const maxAttempts = 8
const backoffDelay = 500

const fetchAgreementWithRetry = async (sbi, logger, attemptCount = 1) => {
  if (attemptCount > maxAttempts) {
    throw Boom.internal(
      `Agreement was added to the queue, but failed to create/retrieve agreement after multiple attempts for SBI: ${sbi}. Verify data format is correct by checking the logs for errors.`
    )
  }

  // Attempt to get the agreement data
  try {
    const agreement = await getAgreementData({ sbi })
    logger.info(
      `Test queue - Successfully retrieved agreement data for SBI: ${sbi} after ${attemptCount} attempts`
    )
    return agreement
  } catch (error) {
    if (isBoom(error) && error.output.statusCode === statusCodes.notFound) {
      logger.error(
        error,
        `Test queue - Agreement for: ${sbi} does not exist yet, retrying...`
      )
      await new Promise((resolve) => setTimeout(resolve, backoffDelay))
      return fetchAgreementWithRetry(sbi, logger, attemptCount + 1)
    } else {
      logger.error(
        error,
        `Test queue - Failed to retrieve agreement data for SBI: ${sbi}`
      )
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

      const baseQueueUrl = config.get('sqs.queueUrl').split('/')
      const defaultQueueName = baseQueueUrl.pop()
      const { queueName = defaultQueueName } = request.params
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
        MessageBody: JSON.stringify(queueMessage),
        MessageGroupId: config.get('serviceName')
      })

      const result = await sqsClient.send(command)
      request.logger.info(
        `Successfully posted test queue message to: "${queueUrl}" with MessageId: ${result.MessageId}`
      )

      let agreementData
      if (queueName === defaultQueueName) {
        // Get the agreement from the database by SBI
        agreementData = await fetchAgreementWithRetry(
          queueMessage.data.identifiers.sbi,
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
