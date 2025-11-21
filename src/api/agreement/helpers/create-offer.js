import crypto from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'
import Boom from '@hapi/boom'

import agreementsModel from '~/src/api/common/models/agreements.js'
import { publishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { config } from '~/src/config/index.js'
import { doesAgreementExist } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { buildLegacyPaymentFromApplication } from './legacy-application-mapper.js'

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
  await ensureAgreementDataIsValid(notificationMessageId, agreementData)

  const {
    clientRef,
    code,
    identifiers,
    scheme,
    agreementName,
    actionApplications,
    payment,
    applicant
  } = resolveAgreementFields(agreementData)

  const agreementNumber = determineAgreementNumber(agreementData)

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
      clientRef,
      frn: identifiers.frn,
      sbi: identifiers.sbi
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
        date: new Date().toISOString(),
        code,
        endDate: payment?.agreementEndDate
      }
    },
    logger
  )

  return agreement
}

export { createOffer }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
/** @import { Request } from '@hapi/hapi' */

async function ensureAgreementDataIsValid(
  notificationMessageId,
  agreementData
) {
  if (!agreementData) {
    throw new Error('Offer data is required')
  }

  if (await doesAgreementExist({ notificationMessageId })) {
    throw new Error('Agreement has already been created')
  }
}

function resolveAgreementFields(agreementData) {
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

  const { resolvedActions, resolvedPayment, resolvedApplicant } =
    buildLegacyAgreementContent(
      agreementData,
      actionApplications,
      payment,
      applicant
    )

  return {
    clientRef,
    code,
    identifiers,
    scheme,
    agreementName,
    actionApplications: resolvedActions,
    payment: resolvedPayment,
    applicant: resolvedApplicant
  }
}

function convertFromLegacyApplicationFormat(agreementData) {
  // TODO: UI will need to be modified to omit payment schedule details once they are deprecated
  return buildLegacyPaymentFromApplication(agreementData)
}

function convertFromAnswersParcelsFormat(agreementData) {
  // Convert the answers structure to application-like structure for the mapper
  const answers = agreementData?.answers || {}
  const applicationLikeData = {
    ...agreementData,
    application: {
      applicant: answers.applicant,
      totalAnnualPaymentPence: answers.totalAnnualPaymentPence,
      parcels: answers.parcels || answers.parcel || [],
      agreementStartDate: answers.agreementStartDate,
      agreementEndDate: answers.agreementEndDate,
      paymentFrequency: answers.paymentFrequency,
      durationYears: answers.durationYears
    }
  }
  return buildLegacyPaymentFromApplication(applicationLikeData)
}

function mergeConvertedValues(existing, converted, fieldName) {
  return existing || converted[fieldName]
}

function validateResolvedContent(resolvedPayment, resolvedApplicant) {
  if (!resolvedPayment || !resolvedApplicant) {
    throw Boom.badRequest('Offer data is missing payment and applicant')
  }
}

function buildLegacyAgreementContent(
  agreementData,
  actionApplications,
  payment,
  applicant
) {
  let resolvedActions = actionApplications
  let resolvedPayment = payment
  let resolvedApplicant = applicant

  // Check if we need to convert from application format (legacy) or answers.parcels format (new)
  if (!resolvedPayment || !resolvedActions || !resolvedApplicant) {
    let converted = null

    try {
      if (agreementData.application) {
        converted = convertFromLegacyApplicationFormat(agreementData)
      } else if (
        agreementData.answers?.parcels ||
        agreementData.answers?.parcel
      ) {
        converted = convertFromAnswersParcelsFormat(agreementData)
      } else {
        converted = null
      }
    } catch (conversionError) {
      converted = null
    }

    if (converted) {
      resolvedPayment = mergeConvertedValues(
        resolvedPayment,
        converted,
        'payment'
      )
      resolvedActions = mergeConvertedValues(
        resolvedActions,
        converted,
        'actionApplications'
      )
      resolvedApplicant = mergeConvertedValues(
        resolvedApplicant,
        converted,
        'applicant'
      )
    }
  }

  validateResolvedContent(resolvedPayment, resolvedApplicant)

  return {
    resolvedActions,
    resolvedPayment,
    resolvedApplicant
  }
}

function determineAgreementNumber(agreementData) {
  if (config.get('featureFlags.seedDb') && agreementData.agreementNumber) {
    return agreementData.agreementNumber
  }

  return generateAgreementNumber()
}
