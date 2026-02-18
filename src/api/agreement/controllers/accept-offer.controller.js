import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import { unacceptOffer } from '~/src/api/agreement/helpers/unaccept-offer.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import { config } from '~/src/config/index.js'
import { publishEvent } from '~/src/api/common/helpers/sns-publisher.js'

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
    const agreementUrl = `${config.get('viewAgreementURI')}/${agreementNumber}`
    agreementData = await acceptOffer(
      agreementNumber,
      agreementData,
      request.logger
    )

    let claimId
    try {
      // Update the payment hub
      const paymentHubResult = await updatePaymentHub(request, agreementNumber)
      claimId = paymentHubResult.claimId
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
      request.logger
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
