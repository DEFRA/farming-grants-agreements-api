import { statusCodes } from '#~/api/common/constants/status-codes.js'
import { acceptOffer } from '#~/api/agreement/helpers/accept-offer.js'
import { unacceptOffer } from '#~/api/agreement/helpers/unaccept-offer.js'
import { updatePaymentHub } from '#~/api/agreement/helpers/update-payment-hub.js'
import { config } from '#~/config/index.js'
import { publishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { sendMessage } from '#~/api/common/helpers/sqs-send-message.js'
import { createGrantPaymentFromAgreement } from '#~/api/common/helpers/create-grant-payment-from-agreement.js'

const queueUrl =
  'http://localhost:4566/000000000000/gps__sqs__create_payment.fifo'

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

      request.logger?.info?.(`********* Before sending CREATE_GRANT_PAYMENT`)

      await sendMessage(
        {
          queueUrl,
          type: 'CREATE_GRANT_PAYMENT',
          data: await createGrantPaymentFromAgreement(
            agreementNumber,
            request.logger
          )
        },
        request.logger
      )

      request.logger?.info?.(`********* After sending CREATE_GRANT_PAYMENT`)
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
