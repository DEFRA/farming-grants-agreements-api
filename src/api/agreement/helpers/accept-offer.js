import Boom from '@hapi/boom'
import agreementsModel from '#~/api/common/models/agreements.js'
import { config } from '#~/config/index.js'
import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'

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

  const expectedPayments = await calculatePaymentsBasedOnParcelsWithActions(
    agreementData.application.parcel,
    logger
  )

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
          payment: expectedPayments
        }
      }
    )
    .catch((error) => {
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
