import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { publishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { config } from '~/src/config/index.js'
import { doesAgreementExist } from '~/src/api/agreement/helpers/get-agreement-data.js'

export const generateAgreementNumber = () => {
  const minRandomNumber = 100000000
  const maxRandomNumber = 999999999
  const randomNum = crypto.randomInt(minRandomNumber, maxRandomNumber)
  return `SFI${randomNum}`
}

/**
 * Create a new offer
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {Agreement} agreementData - The agreement data
 * @param {Request<ReqRefDefaults>['logger']} logger
 * @returns {Promise<Agreement>} The agreement data
 */
const createOffer = async (notificationMessageId, agreementData, logger) => {
  if (!agreementData) {
    throw new Error('Offer data is required')
  }

  if (await doesAgreementExist({ notificationMessageId })) {
    throw new Error('Agreement has already been created')
  }

  const {
    clientRef,
    code,
    identifiers,
    answers: { scheme, actionApplications, payment, applicant } = {}
  } = agreementData

  let agreementNumber = generateAgreementNumber()
  if (config.get('featureFlags.seedDb') && agreementData.agreementNumber) {
    agreementNumber = agreementData.agreementNumber
  }

  const data = {
    notificationMessageId,
    correlationId: uuidv4(),
    clientRef,
    code,
    identifiers,
    scheme,
    actionApplications,
    payment,
    applicant
  }

  const agreement = await agreementsModel.createAgreementWithVersions({
    agreement: {
      agreementNumber,
      frn: identifiers.frn,
      sbi: identifiers.sbi,
      createdBy: 'system'
    },
    versions: [data] // can pass multiple payloads
  })

  // Publish event to SNS
  await publishEvent(
    {
      topicArn: config.get('aws.sns.topic.offerCreated.arn'),
      type: config.get('aws.sns.topic.offerCreated.type'),
      time: new Date().toISOString(),
      data: {
        correlationId: data?.correlationId,
        clientRef: data?.clientRef,
        offerId: agreement.agreementNumber,
        frn: agreement.frn,
        sbi: agreement.sbi
      }
    },
    logger
  )

  return agreement
}

export { createOffer }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
/** @import { Request } from '@hapi/hapi' */
