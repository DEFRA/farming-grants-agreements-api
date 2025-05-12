import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Create a new agreement
 * @param {Agreement} agreementData - The agreement data
 * @returns {Promise<Agreement>} The agreement data
 */
const createAgreement = async (agreementData) =>
  await agreementsModel.create(agreementData).catch((error) => {
    throw Boom.internal(error)
  })

export { createAgreement }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
