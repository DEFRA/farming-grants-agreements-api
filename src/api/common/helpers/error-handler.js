/**
 * Hapi plugin for registering the default error handler
 */
export const errorHandlerPlugin = {
  name: 'error-handler',
  register: (server) => {
    server.ext('onPreResponse', async (request, h) => {
      const response = request.response
      if (response.isBoom) {
        // Prevent all forms of caching in the browser and proxies
        response.output.headers['Cache-Control'] =
          'no-store, no-cache, must-revalidate, proxy-revalidate'
        response.output.headers.Pragma = 'no-cache'
        response.output.headers.Expires = '0'
        response.output.headers['Surrogate-Control'] = 'no-store'

        if (response.output.statusCode === 401) {
          request.server.logger.info(
            'Handling 401 error with unauthorized template'
          )

          try {
            const { nunjucksEnvironment } = await import(
              '~/src/config/nunjucks/nunjucks.js'
            )

            const { context } = await import(
              '~/src/config/nunjucks/context/context.js'
            )
            const templateContext = await context(request)
            templateContext.errorMessage = response.message

            request.server.logger.info('Context generated successfully:', {
              serviceName: templateContext.serviceName,
              auth: templateContext.auth,
              errorMessage: templateContext.errorMessage
            })

            const html = nunjucksEnvironment.render(
              'views/unauthorized.njk',
              templateContext
            )
            request.server.logger.info(
              'Template rendered successfully, length:',
              html.length
            )

            return h
              .response(html)
              .code(401)
              .type('text/html')
              .header(
                'Cache-Control',
                'no-store, no-cache, must-revalidate, proxy-revalidate'
              )
              .header('Pragma', 'no-cache')
              .header('Expires', '0')
              .header('Surrogate-Control', 'no-store')
          } catch (error) {
            request.server.logger.error(
              'Failed to render unauthorized template:',
              error
            )
            return h.continue
          }
        }
      }
      return h.continue
    })
  }
}
