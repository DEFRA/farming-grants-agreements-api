import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Controller to display the Accept Offer page
 * Renders a Nunjucks template with agreement data (no acceptance logic)
 * @satisfies {Partial<ServerRoute>}
 */
const displayAcceptOfferController = {
  handler: (request, h) => {
    try {
      const { agreementData } = request.auth.credentials

      // Render the accept offer template with agreement data
      return h
        .response({
          agreementData
        })
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.ok)
    } catch (error) {
      // Let Boom errors pass through to the error handler
      if (error.isBoom) {
        throw error
      }

      request.logger.error(
        error,
        `Error displaying accept offer page: ${error.message}`
      )
      return h
        .response({
          message: 'Failed to display accept offer page',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { displayAcceptOfferController }
