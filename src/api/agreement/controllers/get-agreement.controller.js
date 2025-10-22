import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Controller to serve the get agreement
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const getAgreementController = (request, h) => {
  const { agreementData } = request.auth.credentials

  // Render the page with base context automatically applied
  return h.response({ agreementData }).code(statusCodes.ok)
}

export { getAgreementController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
