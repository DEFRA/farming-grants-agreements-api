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
        date: acceptanceTime
      }
    },
    logger
  )

  return agreement
}

/**
 * Get the first payment date for a given agreement start date
 * The first quarterly payment date is always 3 calendar months + 5 days after the agreement start date
 * @param {string} agreementStartDate - The date to get the next quarterly date for
 * @returns {string} The next quarterly date in 'Month Year' format
 */
function getFirstPaymentDate(agreementStartDate) {
  const THREE_MONTHS = 3
  const FIVE_DAYS = 5

  const nextPaymentDate = new Date(agreementStartDate)
  nextPaymentDate.setMonth(nextPaymentDate.getMonth() + THREE_MONTHS)
  nextPaymentDate.setDate(nextPaymentDate.getDate() + FIVE_DAYS)

  const nextPaymentString = nextPaymentDate.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric'
  })
  return nextPaymentString === 'Invalid Date' ? '' : nextPaymentString
}

export { acceptOffer, getFirstPaymentDate }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
/** @import { Request } from '@hapi/hapi' */
