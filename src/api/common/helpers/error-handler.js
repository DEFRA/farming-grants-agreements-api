/**
 * Hapi plugin for registering the default error handler
 */
export const errorHandlerPlugin = {
  name: 'error-handler',
  register: (server) => {
    // Register the error handler extension
    server.ext('onPreResponse', (request, h) => {
      const response = request.response

      // Check if response is an error (Boom is used by default in Hapi)
      if (response.isBoom) {
        // Prevent all forms of caching in the browser and proxies
        response.output.headers['Cache-Control'] =
          'no-store, no-cache, must-revalidate, proxy-revalidate'
        response.output.headers.Pragma = 'no-cache'
        response.output.headers.Expires = '0'
        response.output.headers['Surrogate-Control'] = 'no-store'
      }

       if (Buffer.isBuffer(response?.source) || response?.source?.pipe) {
          return h.continue;
        }

      return h.continue
    })
  }
}
