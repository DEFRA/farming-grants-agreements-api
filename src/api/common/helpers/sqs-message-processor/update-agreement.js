import { withdrawOffer } from '#~/api/agreement/helpers/withdraw-offer.js'
import { publishEvent } from '../sns-publisher.js'
import { config } from '#~/config/index.js'

/**
 * Handle an event from the SQS queue
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {Message} payload - The message payload
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<void>}
 */
export const handleUpdateAgreementEvent = async (
  notificationMessageId,
  payload,
  logger
) => {
  const { data = {} } = payload || {}
  let updatedVersion
  if (data.clientRef && data.agreementNumber && data.status === 'withdrawn') {
    logger.info(
      `Received application withdrawn from event: ${notificationMessageId}`
    )
    updatedVersion = await withdrawOffer(data.clientRef, data.agreementNumber)
    logger.info(`Offer withdrawn: ${updatedVersion.agreement.agreementNumber}`)
  } else {
    const status = data.status ? ` (${data.status})` : ''
    logger.info(
      `No action required for GAS application status update event: ${payload?.type || JSON.stringify(payload)}${status}`
    )
  }

  if (updatedVersion) {
    // Publish event to SNS
    await publishEvent(
      {
        topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
        type: config.get('aws.sns.topic.agreementStatusUpdate.type'),
        time: new Date().toISOString(),
        data: {
          agreementNumber: updatedVersion.agreement.agreementNumber,
          correlationId: updatedVersion.correlationId,
          clientRef: updatedVersion.clientRef,
          status: updatedVersion.status,
          date: updatedVersion.updatedAt,
          code: updatedVersion.code
        }
      },
      logger
    )
  }
}

/**
 * @import { Message } from '@aws-sdk/client-sqs'
 */
