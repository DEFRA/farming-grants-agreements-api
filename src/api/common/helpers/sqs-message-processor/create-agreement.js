import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'

/**
 * Handle an event from the SQS queue
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {object} payload - The message payload
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<Agreement>}
 */
export const handleCreateAgreementEvent = async (
  notificationMessageId,
  payload,
  logger
) => {
  logger.info(
    `Received event: ${notificationMessageId} ${JSON.stringify(payload)}`
  )
  if (payload.type?.includes('gas-backend.agreement.create')) {
    logger.info(`Creating agreement from event: ${notificationMessageId}`)
    const agreement = await createOffer(
      notificationMessageId,
      payload.data,
      logger
    )
    logger.info(`Agreement created: ${agreement.agreementNumber}`)
    return agreement
  }

  throw new Error(`Unrecognized event type: ${payload.type}`)
}

/**
 * @import { Agreement } from '~/src/api/common/types/agreement.d.js'
 * @import { Message } from '@aws-sdk/client-sqs'
 */
