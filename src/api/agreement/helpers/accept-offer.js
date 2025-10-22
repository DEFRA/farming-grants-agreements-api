import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { publishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { config } from '~/src/config/index.js'

/**
 * Get agreement data for rendering templates
 * @param {agreementNumber} agreementNumber - The agreement Id
 * @param {Agreement} agreementData - The agreement data
 * @param {string} agreementUrl - The Agreement URL to generate the agreement PDF
 * @param {Request<ReqRefDefaults>['logger']} logger - The logger object
 * @returns {Promise<Agreement>} The agreement data
 */
async function acceptOffer(
  agreementNumber,
  agreementData,
  agreementUrl,
  logger
) {
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

  // Update the agreement in the database
  const agreement = await agreementsModel
    .updateOneAgreementVersion(
      {
        agreementNumber
      },
      {
        $set: {
          status: acceptedStatus,
          signatureDate: acceptanceTime
        }
      }
    )
    .catch((error) => {
      throw Boom.internal(error)
    })

  if (!agreement) {
    throw Boom.notFound(`Offer not found with ID ${agreementNumber}`)
  }

  // Publish event to SNS
  await publishEvent(
    {
      topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
      type: config.get('aws.sns.topic.agreementStatusUpdate.type'),
      time: acceptanceTime,
      data: {
        agreementNumber,
        correlationId: agreementData?.correlationId,
        clientRef: agreementData?.clientRef,
        version: agreementData?.version,
        agreementUrl,
        status: acceptedStatus,
        date: acceptanceTime,
        code: agreementData?.code
      }
    },
    logger
  )

  return agreement
}

export { acceptOffer }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
/** @import { Request } from '@hapi/hapi' */
