import { withdrawOffer } from '~/src/api/agreement/helpers/withdraw-offer.js'

/**
 * Handle an event from the SQS queue
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {object} payload - The message payload
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<Agreement>}
 */
export const handleUpdateAgreementEvent = async (
  notificationMessageId,
  payload,
  logger
) => {
  const { data = {} } = payload
  if (data.status?.includes?.('APPLICATION_WITHDRAWN') && data.clientRef) {
    logger.info(
      `Received application withdrawn from event: ${notificationMessageId}`
    )
    const version = await withdrawOffer(data.clientRef)
    logger.info(`Offer withdrawn: ${version.agreement.agreementNumber}`)
    return version
  }

  throw new Error('Unrecognized event type')
}

/**
 * @import { Agreement } from '~/src/api/common/types/agreement.d.js'
 * @import { Message } from '@aws-sdk/client-sqs'
 */
