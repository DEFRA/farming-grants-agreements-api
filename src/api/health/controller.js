import mongoose from 'mongoose'

import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * A generic health-check endpoint. Used by the platform to check if the service is up and handling requests.
 * @satisfies {Partial<ServerRoute>}
 */
const healthController = {
  handler: async (_request, h) => {
    try {
      if (!(await mongoose.connection.db.admin().ping()).ok) {
        throw new Error('MongoDB ping failed')
      }
    } catch (e) {
      return h
        .response({
          message: 'Unable to connect to backend MongoDB',
          error: e.message
        })
        .code(statusCodes.serviceUnavailable)
    }

    return h.response({ message: 'success' }).code(statusCodes.ok)
  }
}

export { healthController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
