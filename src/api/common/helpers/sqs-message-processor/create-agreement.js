import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'

/**
 * Handle an event from the SQS queue
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {Message} payload - The message payload
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<void>}
 */
export const handleCreateAgreementEvent = async (
  notificationMessageId,
  payload,
  logger
) => {
  if (payload?.type?.includes('gas-backend.agreement.create')) {
    if (logger?.info) {
      logger.info(`Creating agreement from event: ${notificationMessageId}`)
    }

    // Log full payload at info level BEFORE processing to help diagnose errors
    try {
      if (logger?.info) {
        logger.info(
          `Full incoming message payload (as received): ${JSON.stringify(payload, null, 2)}`
        )
      }
    } catch (logError) {
      // If logging fails, log a warning but continue processing
      if (logger?.error) {
        logger.error(
          logError,
          'Failed to log full payload, continuing with processing'
        )
      }
    }

    const agreement = await createOffer(
      notificationMessageId,
      payload.data,
      logger
    )
    if (logger?.info) {
      logger.info(`Agreement created: ${agreement.agreementNumber}`)
    }
  } else {
    if (logger?.info) {
      logger.info(
        `No action required for GAS create offer event: ${payload?.type || JSON.stringify(payload)}`
      )
    }
  }
}

/**
 * @import { Message } from '@aws-sdk/client-sqs'
 */
