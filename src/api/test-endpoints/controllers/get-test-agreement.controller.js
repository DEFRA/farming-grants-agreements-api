import Boom from '@hapi/boom'
import { getAgreementDataById } from '#~/api/agreement/helpers/get-agreement-data.js'
import { statusCodes } from '#~/api/common/constants/status-codes.js'

/**
 * GET /api/test/agreement?id={?}
 * Fetch one or many agreements by agreement number (comma-delimited)
 * @satisfies {Partial<ServerRoute>}
 */
const getTestAgreementController = {
  handler: async (request, h) => {
    try {
      const ids = Array.isArray(request.query.id)
        ? request.query.id.join(',')
        : request.query.id
      if (!ids) {
        throw Boom.badRequest('Missing id query parameter')
      }
      // Support comma-delimited ids
      const idList = ids
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
      if (idList.length === 0) {
        throw Boom.badRequest('No valid ids provided')
      }
      // Use getAgreementData for each id
      const agreements = await Promise.all(
        idList.map(async (id) => {
          try {
            return await getAgreementDataById(id)
          } catch (e) {
            return null
          }
        })
      )
      const found = agreements.filter(Boolean)
      if (!found.length) {
        throw Boom.notFound('No agreements found for provided id(s)')
      }
      return h.response(found).code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }
      request.logger?.error?.(`Error fetching agreement(s): ${error}`)
      return h
        .response({
          message: 'Failed to fetch agreement(s)',
          error: 'An unexpected error occurred'
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { getTestAgreementController }
