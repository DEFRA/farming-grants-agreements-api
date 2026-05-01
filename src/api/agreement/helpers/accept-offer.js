import { randomUUID } from 'node:crypto'

import Boom from '@hapi/boom'
import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'
import { unacceptOffer } from '#~/api/agreement/helpers/unaccept-offer.js'
import { updateAgreementWithVersionViaGrant } from '#~/api/agreement/helpers/update-agreement-with-version-via-grant.js'
import { config } from '#~/config/index.js'
import { publishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { auditEvent, AuditEvent } from '#~/api/common/helpers/audit-event.js'
import { sendGrantPaymentEvent } from '#~/api/common/helpers/send-grant-payment-event.js'

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

  const expectedPayments = await calculatePaymentsBasedOnParcelsWithActions({
    parcels: agreementData.application.parcel,
    logger
  })

  if (!expectedPayments) {
    throw Boom.badImplementation('Failed to calculate expected payments')
  }

  // Add correlation IDs to payment data (preserve existing ones)
  const paymentWithCorrelationIds = {
    ...expectedPayments,
    payments: expectedPayments.payments.map((payment, index) => {
      // Check if there's an existing payment with correlation ID at this index
      const existingPayment = agreementData.payment?.payments?.[index]
      return {
        ...payment,
        correlationId: existingPayment?.correlationId || randomUUID()
      }
    })
  }

  // Update the agreement in the database
  const updateData = {
    status: 'accepted',
    payment: paymentWithCorrelationIds
  }

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
    const grantPaymentsData = await sendGrantPaymentEvent(agreementData, logger)
    claimId = grantPaymentsData.claimId
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
