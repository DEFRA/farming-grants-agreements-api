export const errorHandlerPlugin = {
  name: 'error-handler',
  register: (server) => {
    server.ext('onPreResponse', async (request, h) => {
      const res = request.response

      // Only handle Boom errors
      if (!res?.isBoom) return h.continue

      // Never cache error pages
      const noCache = {
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store',
        Vary: 'Authorization'
      }

      const status = res.output?.statusCode ?? 500

      // Map statuses to templates (extend as needed)
      const TEMPLATE_BY_STATUS = {
        401: 'views/unauthorized.njk',
        403: 'views/forbidden.njk'
      }

      const templatePath = TEMPLATE_BY_STATUS[status]

      // If we don't have a template for this status, let Hapi/ Boom continue
      if (!templatePath) {
        Object.assign(res.output.headers, noCache)
        return h.continue
      }

      server.logger.info(`Handling ${status} with template ${templatePath}`)

      try {
        const [{ renderTemplate }, { context }] = await Promise.all([
          import('~/src/api/agreement/helpers/nunjucks-renderer.js'),
          import('~/src/config/nunjucks/context/context.js')
        ])

        const templateContext = await context(request)
        templateContext.errorMessage = res.message

        server.logger.info('Context generated', {
          serviceName: templateContext.serviceName,
          auth: templateContext.auth,
          errorMessage: templateContext.errorMessage
        })

        const html = renderTemplate(templatePath, templateContext)
        server.logger.info('Template rendered', { length: html.length })

        const reply = h.response(html).code(status).type('text/html')
        for (const [k, v] of Object.entries(noCache)) reply.header(k, v)

        // Helpful auth hint for 401s
        if (status === 401) {
          reply.header('WWW-Authenticate', 'Bearer realm="agreements"')
        }

        return reply
      } catch (error) {
        server.logger.error(`Failed to render ${status} template`, error)
        // Fall back to default Boom payload (still no-cache)
        Object.assign(res.output.headers, noCache)
        return h.continue
      }
    })
  }
}
