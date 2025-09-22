import crypto from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'
import { Boom } from '@hapi/boom'

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
    answers: {
      scheme,
      agreementName,
      actionApplications,
      payment,
      applicant
    } = {}
  } = agreementData

  if (!payment || !applicant) {
    throw new Boom('Offer data is missing payment and applicant')
  }

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
    agreementName,
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
      topicArn: config.get('aws.sns.topic.agreementStatusUpdate.arn'),
      type: config.get('aws.sns.topic.agreementStatusUpdate.type'),
      time: new Date().toISOString(),
      data: {
        agreementNumber: agreement.agreementNumber,
        correlationId: data?.correlationId,
        clientRef,
        status: 'offered',
        date: new Date().toISOString()
      }
    },
    logger
  )

  return agreement
}

export { createOffer }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
/** @import { Request } from '@hapi/hapi' */
