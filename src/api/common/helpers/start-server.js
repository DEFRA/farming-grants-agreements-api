import { config } from '~/src/config/index.js'
import crypto from 'node:crypto'

import { createServer } from '~/src/api/index.js'
import { createLogger } from '~/src/api/common/helpers/logging/logger.js'

async function startServer(options = {}) {
  let server

  try {
    server = await createServer(options)
    server.ext('onPreResponse', (request, h) => {
      const nonce = crypto.randomBytes(16).toString('base64')
      request.app.cspNonce = nonce

      const csp = [
        `script-src 'self' 'strict-dynamic' 'nonce-${nonce}'`,
        `object-src 'none'`,
        `base-uri 'self'`
      ].join('; ')

      const res = request.response.isBoom
        ? request.response.output
        : request.response
      if (request.response.isBoom) {
        res.headers = res.headers || {}
        res.headers['content-security-policy'] = csp
      } else {
        res.header('content-security-policy', csp)
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
    await server.start()

    server.logger.info('Server started successfully')
    server.logger.info(
      `Access your backend on http://localhost:${config.get('port')}`
    )
  } catch (error) {
    const logger = createLogger()
    logger.info('Server failed to start :(')
    logger.error(error)
  }

  return server
}

export { startServer }
