import { config } from '#~/config/index.js'
import { publishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { createGrantPaymentFromAgreement } from '#~/api/common/helpers/create-grant-payment-from-agreement.js'
import agreementsModel from '#~/api/common/models/agreements.js'

/**
 * Sends a grant payment event to the payments service and updates the agreement status.
 * @param {object} agreementData - The full agreement/version data.
 * @param {object} logger - Logger instance.
 * @returns {Promise<object>} The grant payment data sent.
 */
export const sendGrantPaymentEvent = async (agreementData, logger) => {
  const agreementNumber = agreementData.agreementNumber

  const grantPaymentsData = await createGrantPaymentFromAgreement(
    agreementData,
    logger
  )

  await publishEvent(
    {
      topicArn: config.get('aws.sns.topic.createPayment.arn'),
      type: config.get('aws.sns.topic.createPayment.type'),
      time: new Date().toISOString(),
      data: grantPaymentsData
    },
    logger
  )

  await agreementsModel.updateOneAgreementVersion(
    { agreementNumber },
    { $set: { grantsPaymentServiceRequestMade: true } }
  )

  return grantPaymentsData
}
