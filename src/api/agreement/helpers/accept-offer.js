import { randomUUID } from 'node:crypto'

import Boom from '@hapi/boom'
import agreementsModel from '#~/api/common/models/agreements.js'
import { config } from '#~/config/index.js'
import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'
import { isWmpAgreement } from '#~/api/agreement/helpers/wmp-payload-mapper.js'

/**
 * Accept an agreement offer
 * @param {agreementNumber} agreementNumber - The agreement Id
 * @param {Agreement} agreementData - The agreement data
 * @param {Logger} logger - The logger
 * @returns {Promise<Agreement>} The agreement data
 */
async function acceptOffer(agreementNumber, agreementData, logger) {
  if (!agreementNumber || !agreementData) {
    throw Boom.badRequest('Agreement data is required')
  }

  const acceptanceTime = new Date().toISOString()
  const acceptedStatus = 'accepted'

  // Validate PDF service configuration before accepting
  const bucket = config.get('files.s3.bucket')
  const region = config.get('files.s3.region')

  if (!bucket) {
    throw Boom.badImplementation(
      'PDF service configuration missing: FILES_S3_BUCKET not set'
    )
  }

  if (!region) {
    throw Boom.badImplementation(
      'PDF service configuration missing: FILES_S3_REGION not set'
    )
  }

  // WMP: payment was persisted from the payload at create time and Land
  // Grants does not know WMP action codes — skip the lookup and reuse the
  // existing payment subdoc (plan.md §4.3 / §12.2 edit #8).
  let paymentWithCorrelationIds
  if (isWmpAgreement(agreementData)) {
    paymentWithCorrelationIds = agreementData.payment
  } else {
    const expectedPayments = await calculatePaymentsBasedOnParcelsWithActions(
      agreementData.application.parcel,
      logger
    )
    paymentWithCorrelationIds = {
      ...expectedPayments,
      payments: expectedPayments.payments.map((payment) => ({
        ...payment,
        correlationId: payment.correlationId || randomUUID()
      }))
    }
  }

  // Update the agreement in the database
  const agreement = await agreementsModel
    .updateOneAgreementVersion(
      {
        agreementNumber
      },
      {
        $set: {
          status: acceptedStatus,
          signatureDate: acceptanceTime,
          payment: paymentWithCorrelationIds
        }
      }
    )
    .catch((error) => {
      if (error?.isBoom) {
        throw error
      }
      throw Boom.internal(error)
    })

  if (!agreement) {
    throw Boom.notFound(`Offer not found with ID ${agreementNumber}`)
  }

  return { agreementNumber, ...agreement }
}

export { acceptOffer }

/** @import { Agreement } from '#~/api/common/types/agreement.d.js' */
/** @import { Request } from '@hapi/hapi' */
