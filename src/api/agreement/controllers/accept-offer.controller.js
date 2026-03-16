import { statusCodes } from '#~/api/common/constants/status-codes.js'
import { acceptOffer } from '#~/api/agreement/helpers/accept-offer.js'
import { unacceptOffer } from '#~/api/agreement/helpers/unaccept-offer.js'
import { config } from '#~/config/index.js'
import { publishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { createGrantPaymentFromAgreement } from '#~/api/common/helpers/create-grant-payment-from-agreement.js'

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
    const logger = request.logger
    agreementData = await acceptOffer(agreementNumber, agreementData, logger)

    let claimId
    try {
      const grantPaymentsData =
        await createGrantPaymentFromAgreement(agreementNumber)
      claimId = grantPaymentsData.claimId

      logger?.info?.(
        `Passing the data to Grant Payment service ${JSON.stringify(grantPaymentsData, null, 2)}`
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
    } catch (err) {
      // If payments hub has an error rollback the previous accept offer
      await unacceptOffer(agreementNumber)
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
      logger
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
