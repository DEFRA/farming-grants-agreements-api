import { withdrawOffer } from '#~/api/agreement/helpers/withdraw-offer.js'
import { publishEvent } from '../sns-publisher.js'
import { config } from '#~/config/index.js'
import { AGREEMENT_STATUS } from '#~/api/common/constants/agreement-status.js'

export { AGREEMENT_STATUS }

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
  const { clientRef, agreementNumber, status } = data
  const knownStatuses = Object.values(AGREEMENT_STATUS)

  if (!clientRef || !agreementNumber || !knownStatuses.includes(status)) {
    const statusStr = status ? ` (${status})` : ''
    logger.info(
      `No action required for GAS application status update event: ${payload?.type || JSON.stringify(payload)}${statusStr}`
    )
    return
  }

  logger.info(
    `Received application status update (${status}) from event: ${notificationMessageId}`
  )

  let updatedVersion

  if (status === AGREEMENT_STATUS.WITHDRAWN) {
    updatedVersion = await withdrawOffer(clientRef, agreementNumber)
    logger.info(`Offer withdrawn: ${updatedVersion.agreement.agreementNumber}`)
  }

  if (updatedVersion) {
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
