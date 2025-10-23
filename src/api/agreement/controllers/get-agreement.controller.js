import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Controller to serve the get agreement
 * Returns JSON data with agreement information
 * @satisfies {Partial<ServerRoute>}
 */
const getAgreementController = (request, h) => {
  const { agreementData } = request.auth.credentials

  // Return JSON response with agreement data
  return h.response({ agreementData }).code(statusCodes.ok)
}

export { getAgreementController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
