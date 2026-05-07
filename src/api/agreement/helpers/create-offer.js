import crypto from 'node:crypto'
import agreementsModel from '#~/api/common/models/agreements.js'
import { wmpCreateOffer } from './grant-types/wmp/wmp-create-offer.js'
import { fpttCreateOffer } from './grant-types/fptt/fptt-create-offer.js'

const createOfferByCode = {
  woodland: wmpCreateOffer,
  fptt: fpttCreateOffer,
  default: fpttCreateOffer
}

const getCreateOffer = (code) =>
  createOfferByCode[code?.toLowerCase()] ?? createOfferByCode.default

export const generateAgreementNumber = async () => {
  const minRandomNumber = 100000000
  const maxRandomNumber = 999999999
  let agreementNumber
  let agreementNumberExists
  do {
    const randomNum = crypto.randomInt(minRandomNumber, maxRandomNumber)
    agreementNumber = `FPTT${randomNum}`
    agreementNumberExists = await agreementsModel.exists({ agreementNumber })
  } while (agreementNumberExists)
  return agreementNumber
}
/**
 * Create a new offer. Dispatches to the appropriate grant-type handler.
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {Agreement} agreementData - The agreement data
 * @param {Request['logger']} logger
 * @returns {Promise<Agreement>} The agreement data
 */
const createOffer = (notificationMessageId, agreementData, logger) => {
  const create = getCreateOffer(agreementData?.code)
  return create(notificationMessageId, agreementData, logger)
}

export { createOffer }
/** @import { Agreement } from '#~/api/common/types/agreement.d.js' */
/** @import { Request } from '@hapi/hapi' */
