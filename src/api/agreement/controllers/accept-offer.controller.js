import { statusCodes } from '#~/api/common/constants/status-codes.js'
import { acceptOffer } from '#~/api/agreement/helpers/accept-offer.js'
import { unacceptOffer } from '#~/api/agreement/helpers/unaccept-offer.js'
import { config } from '#~/config/index.js'
import { publishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { auditEvent, AuditEvent } from '#~/api/common/helpers/audit-event.js'
import { sendGrantPaymentEvent } from '#~/api/common/helpers/send-grant-payment-event.js'

/**
 * Controller to accept agreement offer
 * Returns JSON data with agreement information
 * @satisfies {Partial<ServerRoute>}
 */
const acceptOfferController = async (request, h) => {
  // Get the agreement data before accepting
  let { agreementData } = request.auth.credentials
  const { agreementNumber } = agreementData

  if (agreementData.status === 'offered') {
    // Accept the agreement
    const agreementUrl = `${String(config.get('viewAgreementURI'))}/${agreementNumber}`
    agreementData = await acceptOffer(
      agreementNumber,
      agreementData,
      request.logger
    )

    let claimId
    try {
      const grantPaymentsData = await sendGrantPaymentEvent(
        agreementData,
        request.logger
      )
      claimId = grantPaymentsData.claimId
    } catch (err) {
      // If payments hub has an error rollback the previous accept offer
      await unacceptOffer(agreementNumber)
      auditEvent(
        AuditEvent.AGREEMENT_CREATED,
        {
          agreementNumber,
          correlationId: agreementData?.correlationId,
          message: err.message
        },
        'failure',
        request
      )
      throw err
    }

    // Publish event to SNS
    await publishEvent(
      {
        topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
        type: config.get('aws.sns.topic.agreementStatusUpdate.type'),
        time: new Date().toISOString(),
        data: {
          agreementNumber,
          correlationId: agreementData?.correlationId,
          clientRef: agreementData?.clientRef,
          version: agreementData?.versions?.length ?? 1,
          agreementUrl,
          status: agreementData.status,
          code: agreementData?.code,
          date: agreementData.updatedAt,
          startDate: agreementData?.payment?.agreementStartDate,
          endDate: agreementData?.payment?.agreementEndDate,
          claimId
        }
      },
      request.logger
    )

    auditEvent(
      AuditEvent.AGREEMENT_CREATED,
      { ...agreementData, agreementNumber },
      'success',
      request
    )
  }

  // Return JSON response with agreement data
  return h
    .response({ agreementData })
    .header('Cache-Control', 'no-cache, no-store, must-revalidate')
    .code(statusCodes.ok)
}

export { acceptOfferController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
