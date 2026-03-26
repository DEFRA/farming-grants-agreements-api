import { withdrawOffer } from '#~/api/agreement/helpers/withdraw-offer.js'
import { cancelOffer } from '#~/api/agreement/helpers/cancel-offer.js'
import { terminateAgreement } from '#~/api/agreement/helpers/terminate-agreement.js'
import { publishEvent } from '../sns-publisher.js'
import { auditEvent, AuditEvent } from '../audit-event.js'
import { config } from '#~/config/index.js'
import { AGREEMENT_STATUS } from '#~/api/common/constants/agreement-status.js'

/**
 * @param {string} status
 * @param {string} clientRef
 * @param {string} agreementNumber
 * @param {import('@hapi/hapi').Server} logger
 * @returns {Promise<object|undefined>}
 */
async function applyStatusUpdate(status, clientRef, agreementNumber, logger) {
  if (status === AGREEMENT_STATUS.WITHDRAWN) {
    const result = await withdrawOffer(clientRef, agreementNumber)
    logger.info(`Offer withdrawn: ${result.agreement.agreementNumber}`)
    return result
  } else if (status === AGREEMENT_STATUS.CANCELLED) {
    const result = await cancelOffer(clientRef, agreementNumber)
    logger.info(`Offer cancelled: ${result.agreement.agreementNumber}`)
    return result
  } else if (status === AGREEMENT_STATUS.TERMINATED) {
    const result = await terminateAgreement(clientRef, agreementNumber)
    logger.info(`Agreement terminated: ${result.agreement.agreementNumber}`)
    return result
  } else {
    return undefined
  }
}

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
    `Received application status update (${status}) from event: ${notificationMessageId} with payload [${JSON.stringify(payload)}]`
  )

  let updatedVersion

  try {
    updatedVersion = await applyStatusUpdate(
      status,
      clientRef,
      agreementNumber,
      logger
    )
  } catch (error) {
    auditEvent(
      AuditEvent.AGREEMENT_UPDATED,
      { agreementNumber, clientRef, status, message: error.message },
      'failure'
    )
    throw error
  }

  if (updatedVersion) {
    auditEvent(AuditEvent.AGREEMENT_UPDATED, {
      ...updatedVersion,
      agreementNumber: updatedVersion.agreement.agreementNumber
    })

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
