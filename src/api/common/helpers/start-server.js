import { config } from '#~/config/index.js'

import { createServer } from '#~/api/index.js'
import { createLogger } from '#~/api/common/helpers/logging/logger.js'

async function startServer(options = {}) {
  let server

  try {
    server = await createServer(options)
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
