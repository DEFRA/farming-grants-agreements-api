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
  const { agreementData } = request.auth.credentials
  const { agreementNumber, status } = agreementData

  if (status === 'offered') {
    // Accept the agreement
    const agreementUrl = `${config.get('viewAgreementURI')}/${agreementNumber}`
    const { signatureDate, status: acceptedStatus } = await acceptOffer(
      agreementNumber,
      agreementData
    )

    try {
      // Update the payment hub
      await updatePaymentHub(request, agreementNumber)
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
        time: signatureDate,
        data: {
          agreementNumber,
          correlationId: agreementData?.correlationId,
          clientRef: agreementData?.clientRef,
          version: agreementData?.version,
          agreementUrl,
          status: acceptedStatus,
          date: signatureDate,
          code: agreementData?.code
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
