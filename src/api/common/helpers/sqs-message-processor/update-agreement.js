import { withdrawOffer } from '~/src/api/agreement/helpers/withdraw-offer.js'

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
  const { data = {} } = payload
  if (data.status?.includes?.('APPLICATION_WITHDRAWN') && data.clientRef) {
    logger.info(
      `Received application withdrawn from event: ${notificationMessageId}`
    )
    const version = await withdrawOffer(data.clientRef)
    logger.info(`Offer withdrawn: ${version.agreement.agreementNumber}`)
  }

  const status = data.status ? ` (${data.status})` : ''
  logger.info(
    `No action required for GAS application status update event: ${payload.type || JSON.stringify(payload)}${status}`
  )
}

/**
 * @import { Message } from '@aws-sdk/client-sqs'
 */
