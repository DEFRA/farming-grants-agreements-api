import crypto from 'node:crypto'
import Boom from '@hapi/boom'
import agreementsModel from '#~/api/common/models/agreements.js'
import { wmpCreateOffer } from './grant-types/wmp/wmp-create-offer.js'
import { fpttCreateOffer } from './grant-types/fptt/fptt-create-offer.js'

const createOfferByCode = {
  woodland: wmpCreateOffer,
  'frps-private-beta': fpttCreateOffer
}

const getCreateOffer = (code) => {
  const create = createOfferByCode[code.toLowerCase()]
  if (!create) {
    throw Boom.badRequest(`Unknown agreement code: ${code}`)
  }
  return create
}

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
  if (!agreementData) {
    throw Boom.badRequest('Offer data is required')
  }
  if (typeof agreementData.code !== 'string' || !agreementData.code.trim()) {
    throw Boom.badRequest('Agreement code is required')
  }
  const create = getCreateOffer(agreementData.code)
  return create(notificationMessageId, agreementData, logger)
}

export { createOffer }
/** @import { Agreement } from '#~/api/common/types/agreement.d.js' */
/** @import { Request } from '@hapi/hapi' */
