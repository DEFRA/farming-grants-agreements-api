import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Controller to display the Offer withdrawn page
 * @satisfies {Partial<ServerRoute>}
 */
const offerWithdrawnController = {
  handler: (request, h) => {
    try {
      return h
        .view('views/error/offer-withdrawn.njk')
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.ok)
    } catch (error) {
      // Let Boom errors pass through to the error handler
      if (error.isBoom) {
        throw error
      }

      request.logger.error(
        error,
        `Error displaying offer withdrawn page: ${error.message}`
      )
      return h
        .response({
          message: 'Failed to display offer withdrawn page',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { offerWithdrawnController }
