import { statusCodes } from '#~/api/common/constants/status-codes.js'
import { fpttResolveGetPayment } from '#~/api/agreement/helpers/grant-types/fptt/fptt-get-agreement.js'
import Boom from '@hapi/boom'

// WMP persists its payment subdoc at create time from the inbound payload
// (plan.md §4.3) — Land Grants must NEVER be consulted on GET. A no-op is
// the correct handler.
const noop = () => Promise.resolve()

const resolveGetPaymentByCode = {
  woodland: noop,
  'frps-private-beta': fpttResolveGetPayment
}

const getResolveGetPayment = (code) => {
  const resolve = resolveGetPaymentByCode[String(code ?? '').toLowerCase()]
  if (!resolve) {
    throw Boom.badImplementation(`Unknown agreement code: ${code}`)
  }
  return resolve
}

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

    const resolveGetPayment = getResolveGetPayment(agreementData.code)
    await resolveGetPayment(agreementData, request.logger)

    // Return JSON response with agreement data
    return h.response({ agreementData, auth: { source } }).code(statusCodes.ok)
  }

export { getAgreementController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
