import path from 'path'
import hapi from '@hapi/hapi'
import CatboxMemory from '@hapi/catbox-memory'

import { config } from '~/src/config/index.js'
import { router } from '~/src/api/router.js'
import { requestLogger } from '~/src/api/common/helpers/logging/request-logger.js'
import { failAction } from '~/src/api/common/helpers/fail-action.js'
import { secureContext } from '~/src/api/common/helpers/secure-context/index.js'
import { pulse } from '~/src/api/common/helpers/pulse.js'
import { requestTracing } from '~/src/api/common/helpers/request-tracing.js'
import { setupProxy } from '~/src/api/common/helpers/proxy/setup-proxy.js'
import { mongooseDb } from '~/src/api/common/helpers/mongoose.js'
import { sqsClientPlugin } from '~/src/api/common/helpers/sqs-client.js'

async function createServer(serverOptions = {}) {
  setupProxy()
  const server = hapi.server({
    port: config.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false
        },
        failAction
      },
      files: {
        relativeTo: path.resolve(config.get('root'), '.public')
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    },
    cache: [
      {
        name: 'agreement-service',
        provider: {
          constructor: CatboxMemory.Engine
        }
      }
    ]
  })

  const options = {
    disableSQS: false,
    ...serverOptions
  }

  // Hapi Plugins:
  // requestLogger    - automatically logs incoming requests
  // requestTracing   - trace header logging and propagation
  // secureContext    - loads CA certificates from environment config
  // pulse            - provides shutdown handlers
  // mongooseDb       - sets up mongoose connection pool and attaches to `server` and `request` objects
  // sqsClientPlugin  - AWS SQS client
  // router           - routes used in the app
  await server.register(
    [
      requestLogger,
      requestTracing,
      secureContext,
      pulse,
      mongooseDb,
      options.disableSQS ? null : sqsClientPlugin,
      router
    ].filter(Boolean)
  )

  return server
}

export { createServer }
