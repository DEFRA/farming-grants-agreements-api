import crypto from 'node:crypto'

/**
 * Hapi plugin for registering the default content security policy handler
 */
export const contentSecurityPolicyHandlerPlugin = {
  name: 'content-security-handler',
  register: (server) => {
    server.ext('onPreResponse', (request, h) => {
      const nonce = crypto.randomBytes(16).toString('base64')
      request.app.cspNonce = nonce

      const csp = [
        `script-src 'self' 'strict-dynamic' 'nonce-${nonce}'`,
        `object-src 'none'`,
        `base-uri 'self'`
      ].join('; ')

      const response = request.response.isBoom
        ? request.response.output
        : request.response
      if (request.response.isBoom) {
        response.headers = response.headers || {}
        response.headers['content-security-policy'] = csp
      } else {
        response.header('content-security-policy', csp)
      }

      // If rendering a view, inject the nonce into the template context
      if (!request.response.isBoom && request.response.variety === 'view') {
        const view = request.response
        view.source.context = {
          ...(view.source.context || {}),
          cspNonce: nonce
        }
      }

      return h.continue
    })
  }
}
