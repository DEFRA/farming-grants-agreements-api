import Boom from '@hapi/boom'
import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'

/**
 * Handle an event from the SQS queue
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {object} payload - The message payload
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<Agreement>}
 */
export const handleEvent = async (notificationMessageId, payload, logger) => {
  if (payload.type.indexOf('gas-backend.agreement.create') !== -1) {
    logger.info(`Creating agreement from event: ${notificationMessageId}`)
    const agreement = await createOffer(
      notificationMessageId,
      payload.data,
      logger
    )
    logger.info(`Agreement created: ${agreement.agreementNumber}`)
    return agreement
  }

  if (payload.type.indexOf('agreement.status.updated') !== -1) {
    logger.info(`Processing agreement status update: ${notificationMessageId}`)
    handleAgreementStatusUpdate(notificationMessageId, payload.data, logger)
    return payload.data
  }

  return Promise.reject(new Error('Unrecognized event type'))
}

/**
 * Handle agreement status update events
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {object} data - The agreement status update data
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {void}
 */
const handleAgreementStatusUpdate = (notificationMessageId, data, logger) => {
  const { status, agreementNumber, agreementUrl } = data

  // Only process 'accepted' status for PDF generation
  if (status === 'accepted' && agreementUrl) {
    logger.info(`PDF generation triggered for agreement ${agreementNumber}`)
  }
}

/**
 * Process a message from the SQS queue
 * @param { Message } message - The message to process
 * @param { import('@hapi/hapi').Server } logger - The logger instance
 * @returns {Promise<void>}
 */
export const processMessage = async (message, logger) => {
  try {
    const messageBody = JSON.parse(message.Body)
    await handleEvent(message.MessageId, messageBody, logger)
  } catch (error) {
    logger.error(
      {
        message,
        error: error.message,
        stack: error.stack
      },
      'Error processing message:'
    )

    if (error.name === 'SyntaxError') {
      throw Boom.badData('Invalid message format', {
        message,
        error: error.message
      })
    }

    throw Boom.boomify(error, {
      statusCode: 500,
      message: 'Error processing SQS message',
      data: {
        message,
        originalError: error.message
      }
    })
  }
}
