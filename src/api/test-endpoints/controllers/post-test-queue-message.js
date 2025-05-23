import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Controller to post a test queue message
 * @satisfies {Partial<ServerRoute>}
 */
const postTestQueueMessageController = {
  handler: (request, h) => {
    try {
      const queueMessage = request.payload

      request.logger.info(
        `Posting test queue message with data: ${JSON.stringify(queueMessage)}`
      )

      if (!queueMessage) {
        throw Boom.internal('Queue message data is required')
      }

      // TODO: Implement the logic to post the test queue message

      return h
        .response({ message: 'Test queue message posted' })
        .code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(`Error posting test queue message: ${error}`)
      return h
        .response({
          message: 'Failed to post test queue message',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { postTestQueueMessageController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
