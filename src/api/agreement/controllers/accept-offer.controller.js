import { statusCodes } from '#~/api/common/constants/status-codes.js'
import { acceptOffer } from '#~/api/agreement/helpers/accept-offer.js'
import { unacceptOffer } from '#~/api/agreement/helpers/unaccept-offer.js'
import { updatePaymentHub } from '#~/api/agreement/helpers/update-payment-hub.js'
import { config } from '#~/config/index.js'
import { publishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { sendMessage } from '~/src/api/common/helpers/sqs-send-message.js'

const grantPaymentPayload = {
  sbi: '106284736',
  frn: '12544567',
  claimId: 'R00000004',
  grants: [
    {
      sourceSystem: 'FPTT',
      paymentRequestNumber: 1,
      correlationId: '7cf9bd11-c791-42c9-bd28-fa0fecb2d92c',
      invoiceNumber: 'R00000004-V001Q2',
      originalInvoiceNumber: 'R00000004-V001Q1',
      agreementNumber: 'FPTT264870631',
      totalAmount: '702.85',
      currency: 'GBP',
      marketingYear: '2026',
      accountCode: 'SOS710',
      fundCode: 'DRD10',
      payments: [
        {
          dueDate: '2026-06-05',
          totalAmount: '12.63',
          status: 'pending',
          invoiceLines: [
            {
              schemeCode: 'CMOR1',
              description: '2026-06-05: Parcel 8083',
              amount: '12.63'
            }
          ]
        }
      ]
    }
  ]
}

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
    } catch (err) {
      // If payments hub has an error rollback the previous accept offer
      await unacceptOffer(agreementNumber)
      throw err
    }

    request.logger?.info?.(`********* Before sending CREATE_GRANT_PAYMENT`)

    // sending grant payment request
    await sendMessage(
      {
        queueUrl,
        type: 'CREATE_GRANT_PAYMENT',
        data: grantPaymentPayload
      },
      request.logger
    )

    request.logger?.info?.(`********* After sending CREATE_GRANT_PAYMENT`)

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
