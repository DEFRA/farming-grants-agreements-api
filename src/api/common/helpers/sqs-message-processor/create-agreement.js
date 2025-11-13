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
    logger.info(`Creating agreement from event: ${notificationMessageId}`)
    logger.info(
      `Incoming message payload structure: ${JSON.stringify({
        hasData: !!payload.data,
        hasAnswers: !!payload.data?.answers,
        hasAnswersPayment: !!payload.data?.answers?.payment,
        hasAnswersApplicant: !!payload.data?.answers?.applicant,
        hasApplication: !!payload.data?.application,
        hasApplicationApplicant: !!payload.data?.application?.applicant,
        clientRef: payload.data?.clientRef,
        code: payload.data?.code,
        identifiers: payload.data?.identifiers
      })}`
    )
    if (logger?.debug) {
      logger.debug(
        `Full incoming message data: ${JSON.stringify(payload.data, null, 2)}`
      )
    }
    const agreement = await createOffer(
      notificationMessageId,
      payload.data,
      logger
    )
    logger.info(`Agreement created: ${agreement.agreementNumber}`)
  } else {
    logger.info(
      `No action required for GAS create offer event: ${payload?.type || JSON.stringify(payload)}`
    )
  }
}

/**
 * @import { Message } from '@aws-sdk/client-sqs'
 */
