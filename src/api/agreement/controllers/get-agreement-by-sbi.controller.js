import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Controller to serve the get agreement
 * Returns JSON data with agreement information
 * @satisfies {Partial<ServerRoute>}
 */
const getAgreementBySBIController = (request, h) => {
  const { agreementData } = request.auth.credentials

  // Return JSON response with agreement data
  return h.response({ agreementData }).code(statusCodes.ok)
}

export { getAgreementBySBIController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
