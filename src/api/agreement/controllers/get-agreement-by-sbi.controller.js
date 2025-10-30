import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import Boom from '@hapi/boom'

/**
 * Controller to serve the get agreement
 * Returns JSON data with agreement information
 * @satisfies {Partial<ServerRoute>}
 */
const getAgreementBySbiController = (request, h) => {
  const { agreementData, source } = request.auth.credentials
  if (source === 'entra') {
    throw Boom.unauthorized(
      `Not allowed to view the agreement. Source: ${source}`
    )
  }

  // Return JSON response with agreement data
  return h.response({ agreementData }).code(statusCodes.ok)
}

export { getAgreementBySbiController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
