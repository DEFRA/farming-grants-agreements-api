import Boom from '@hapi/boom'
import { getGrantTypeByCode } from './grant-types/index.js'

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
  const grantType = getGrantTypeByCode(agreementData.code)
  return grantType.createOffer(notificationMessageId, agreementData, logger)
}

export { createOffer }
/** @import { Agreement } from '#~/api/common/types/agreement.d.js' */
/** @import { Request } from '@hapi/hapi' */
