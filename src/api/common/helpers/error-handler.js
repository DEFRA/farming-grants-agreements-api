/**
 * Hapi plugin for registering the default error handler
 */
export const errorHandlerPlugin = {
  name: 'error-handler',
  register: (server) => {
    server.ext('onPreResponse', (request, h) => {
      const response = request.response
      if (response.isBoom) {
        request.server.logger.info(response)

        try {
          return h
            .response({
              errorMessage: response.message
            })
            .code(response.output.statusCode)
            .header(
              'Cache-Control',
              'no-store, no-cache, must-revalidate, proxy-revalidate'
            )
            .header('Pragma', 'no-cache')
            .header('Expires', '0')
            .header('Surrogate-Control', 'no-store')
        } catch (error) {
          request.server.logger.error(error, 'Failed to create error response:')
          return h.continue
        }
      }
      return h.continue
    })
  }
}
