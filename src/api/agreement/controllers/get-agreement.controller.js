import { statusCodes } from '#~/api/common/constants/status-codes.js'
import { getGrantTypeByCode } from '#~/api/agreement/helpers/grant-types/index.js'
import Boom from '@hapi/boom'

/**
 * Controller to serve the get agreement
 * Returns JSON data with agreement information
 * @satisfies {Partial<ServerRoute>}
 */
const getAgreementController =
  ({ allowEntra } = {}) =>
  async (request, h) => {
    const { agreementData, source } = request.auth.credentials
    if (!allowEntra && source === 'entra') {
      throw Boom.unauthorized(
        `Not allowed to view the agreement. Source: ${source}`
      )
    }

    const grantType = getGrantTypeByCode(agreementData.code)
    const agreementWithPayment = await grantType.buildAgreementWithPayment(
      agreementData,
      request.logger
    )

    return h
      .response({ agreementData: agreementWithPayment, auth: { source } })
      .code(statusCodes.ok)
  }

export { getAgreementController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
