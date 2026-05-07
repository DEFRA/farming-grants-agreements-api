import Boom from '@hapi/boom'

import { createAgreementWithGrantAndVersions } from '#~/api/agreement/helpers/create-agreement-with-grant-and-versions.js'
import { publishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { config } from '#~/config/index.js'
import { doesAgreementExist } from '#~/api/agreement/helpers/get-agreement-data.js'
import { generateAgreementNumber } from '../../create-offer.js'
import { validateWmpCreateAgreement } from '../../schemas/wmp-create-agreement.schema.js'
import { mapWmpPayloadToVersion } from './wmp-payload-mapper.js'

/**
 * Create a WMP offer.
 *
 * **No Land Grants call** is made on this path.
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {object} payload - The raw WMP create-agreement payload
 * @param {import('@hapi/hapi').Request['logger']} logger
 * @returns {Promise<object>} the persisted (populated) parent agreement
 */
export const wmpCreateOffer = async (
  notificationMessageId,
  payload,
  logger
) => {
  if (!payload) {
    throw new Error('Offer data is required')
  }

  if (await doesAgreementExist({ notificationMessageId })) {
    throw new Error('Agreement has already been created')
  }

  // 1. Validate
  const { value: validated, error } = validateWmpCreateAgreement(payload)
  if (error) {
    throw Boom.badRequest(
      `Invalid WMP create-agreement payload: ${error.details
        .map((d) => d.message)
        .join('; ')}`
    )
  }

  // 2. Map → versions document (payment derived entirely from the payload)
  const version = mapWmpPayloadToVersion(validated, { notificationMessageId })

  // 3. Persist (ignorePayments: false → keep WMP payment subdoc)
  const agreementNumber = await generateAgreementNumber()
  const agreement = await createAgreementWithGrantAndVersions({
    agreement: {
      agreementNumber,
      clientRef: version.clientRef,
      sbi: version.identifiers.sbi,
      frn: version.identifiers.frn
    },
    versions: [version],
    ignorePayments: false
  })

  // 4. Announce
  await publishEvent(
    {
      topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
      type: config.get('aws.sns.topic.agreementStatusUpdate.type'),
      time: new Date().toISOString(),
      data: {
        agreementNumber: agreement.agreementNumber,
        correlationId: version.correlationId,
        clientRef: version.clientRef,
        status: 'offered',
        date: agreement.updatedAt,
        code: version.code,
        scheme: version.scheme
      }
    },
    logger
  )

  logger.info(
    `Successfully created WMP agreement ${agreement.agreementNumber} (clientRef=${version.clientRef})`
  )

  return agreement
}
