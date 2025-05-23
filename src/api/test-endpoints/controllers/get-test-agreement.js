import Boom from '@hapi/boom'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'

/**
 * GET /api/test/agreement?id={?}
 * Fetch one or many agreements by agreement number (comma-delimited)
 * @satisfies {Partial<ServerRoute>}
 */
const getTestAgreementController = {
  handler: async (request, h) => {
    try {
      const ids = request.query.id
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
            return await getAgreementData(id)
          } catch (e) {
            return null
          }
        })
      )
      const found = agreements.filter(Boolean)
      if (!found.length) {
        throw Boom.notFound('No agreements found for provided id(s)')
      }
      return h.response(found).code(200)
    } catch (error) {
      if (error.isBoom) {
        return error
      }
      request.logger?.error?.(`Error fetching agreement(s): ${error}`)
      return h
        .response({
          message: 'Failed to fetch agreement(s)',
          error: error.message
        })
        .code(500)
    }
  }
}

export { getTestAgreementController }
