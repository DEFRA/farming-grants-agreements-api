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
    applicant: normaliseApplicant(resolvedApplicant, agreementData?.answers)
  }
}

function convertFromLegacyApplicationFormat(agreementData) {
  // TODO: UI will need to be modified to omit payment schedule details once they are deprecated
  return buildLegacyPaymentFromApplication(agreementData)
}

function convertFromAnswersParcelsFormat(agreementData) {
  // Convert the answers structure to application-like structure for the mapper
  const answers = agreementData?.answers || {}

  // Support both answers.parcels (array) and answers.parcel (singular) in a backwards compatible way
  const parcels =
    answers.parcels || (answers.parcel ? [answers.parcel].flat() : [])

  const applicationLikeData = {
    ...agreementData,
    application: {
      applicant: answers.applicant,
      totalAnnualPaymentPence: answers.totalAnnualPaymentPence,
      parcels,
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
  const missing = []
  if (!resolvedPayment) missing.push('payment')
  if (!resolvedApplicant) missing.push('applicant')
  if (missing.length > 0) {
    throw Boom.badRequest(`Offer data is missing ${missing.join(', ')}`)
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

  // Check if we need to convert from application format (legacy) or answers.parcels/answers.parcel format (new)
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

function normaliseApplicant(applicant, answers = {}) {
  const businessDetails = applicant?.business
    ? { ...applicant.business }
    : undefined

  const address =
    (businessDetails && buildBusinessAddress(businessDetails)) || undefined

  const customer = applicant?.customer || answers?.customer

  return {
    ...(applicant || {}),
    ...(businessDetails
      ? {
          business: {
            ...businessDetails,
            ...(address ? { address } : {})
          }
        }
      : {}),
    ...(customer ? { customer } : {})
  }
}

function buildBusinessAddress(business = {}) {
  if (business.address) {
    return business.address
  }

  const extracted = extractAddressFields(business)

  return extracted
}

const addressKeys = [
  'line1',
  'line2',
  'line3',
  'line4',
  'line5',
  'street',
  'city',
  'postalCode'
]

function extractAddressFields(source = {}) {
  const hasAddressField = addressKeys.some(
    (key) => source[key] !== undefined && source[key] !== null
  )

  if (!hasAddressField) {
    return undefined
  }

  return addressKeys.reduce((acc, key) => {
    if (source[key] !== undefined && source[key] !== null) {
      acc[key] = source[key]
    }
    return acc
  }, {})
}
