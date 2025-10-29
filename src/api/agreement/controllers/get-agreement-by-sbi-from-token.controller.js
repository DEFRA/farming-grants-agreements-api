import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Controller to serve the get agreement
 * Returns JSON data with agreement information
 * @satisfies {Partial<ServerRoute>}
 */
const getAgreementBySbiFromTokenController = (request, h) => {
  const { agreementData } = request.auth.credentials

  // Return JSON response with agreement data
  return h.response({ agreementData }).code(statusCodes.ok)
}

export { getAgreementBySbiFromTokenController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
