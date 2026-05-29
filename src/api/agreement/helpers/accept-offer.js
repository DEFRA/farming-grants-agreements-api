import Boom from '@hapi/boom'
import { getGrantTypeByCode } from '#~/api/agreement/helpers/grant-types/index.js'
import { unacceptOffer } from '#~/api/agreement/helpers/unaccept-offer.js'
import { updateAgreementWithVersionViaGrant } from '#~/api/agreement/helpers/update-agreement-with-version-via-grant.js'
import { config } from '#~/config/index.js'
import { publishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { auditEvent, AuditEvent } from '#~/api/common/helpers/audit-event.js'
import { sendGrantPaymentEvent } from '#~/api/common/helpers/send-grant-payment-event.js'

const WOODLAND_CODE = 'woodland'

/**
 * Update agreement status to accepted (without sending payment event)
 * @param {string} agreementNumber
 * @param {object} agreementData
 * @param {object} logger
 * @returns {Promise<object>}
 */
async function transitionAgreementToAccepted(
  agreementNumber,
  agreementData,
  logger
) {
  if (!agreementNumber || !agreementData) {
    throw Boom.badRequest('Agreement data is required')
  }

  const grantType = getGrantTypeByCode(agreementData.code)
  const payment = await grantType.buildPaymentForAcceptance(
    agreementData,
    logger
  )

  // Update the agreement in the database
  const updateData = { status: 'accepted', payment }

  // Only set signatureDate if it's not already set
  if (!agreementData.signatureDate) {
    updateData.signatureDate = new Date().toISOString()
  }

  const agreement = await updateAgreementWithVersionViaGrant(
    { agreementNumber },
    { $set: updateData }
  )

  if (!agreement) {
    throw Boom.notFound(`Offer not found with ID ${agreementNumber}`)
  }

  return { agreementNumber, ...agreement }
}

// Do not send payment event for woodland grants
// 1. the send payment event is hard coded with frps codes
// 2. the payment event will be sent from elsewhere
// ...refactor to make configurable https://eaflood.atlassian.net/browse/FGP-1122
const sendGrantPaymentEventHandler = async (agreementData, logger) => {
  if (agreementData.code !== WOODLAND_CODE) {
    const grantPaymentsData = await sendGrantPaymentEvent(agreementData, logger)
    return grantPaymentsData.claimId
  }
  return undefined
}

/**
 * Accept an agreement offer with complete flow including payment event, SNS publishing, and audit logging
 * @param {string} agreementNumber - The agreement number
 * @param {object} agreementData - The agreement data
 * @param {object} logger - Logger instance
 * @param {object} requestContext - Request context for audit events (optional)
 * @returns {Promise<object>} The updated agreement data with claimId
 */
async function acceptOffer(
  agreementNumber,
  agreementData,
  logger,
  requestContext = null
) {
  if (!agreementNumber || !agreementData) {
    throw Boom.badRequest('Agreement data is required')
  }

  // Accept the agreement if not already accepted
  const agreementUrl = `${String(config.get('viewAgreementURI'))}/${agreementNumber}`
  if (agreementData.status !== 'accepted') {
    const savedAgreement = await transitionAgreementToAccepted(
      agreementNumber,
      agreementData,
      logger
    )
    // Merge the original agreement data with the database result to ensure we have all required fields
    // Preserve the original agreementNumber from input agreement data
    agreementData = {
      ...agreementData,
      ...savedAgreement,
      agreementNumber: agreementData.agreementNumber
    }
  }

  let claimId
  try {
    claimId = await sendGrantPaymentEventHandler(agreementData, logger)
  } catch (err) {
    // If payments hub has an error rollback the previous accept offer (only if we accepted it)
    if (agreementData.status !== 'accepted') {
      await unacceptOffer(agreementNumber)
    }
    auditEvent(
      AuditEvent.AGREEMENT_CREATED,
      {
        agreementNumber,
        correlationId: agreementData?.correlationId,
        message: err.message
      },
      'failure',
      requestContext
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
    logger
  )

  auditEvent(
    AuditEvent.AGREEMENT_CREATED,
    { ...agreementData, agreementNumber },
    'success',
    requestContext
  )

  return { ...agreementData, claimId }
}

export { acceptOffer }

/** @import { Agreement } from '#~/api/common/types/agreement.d.js' */
/** @import { Request } from '@hapi/hapi' */
