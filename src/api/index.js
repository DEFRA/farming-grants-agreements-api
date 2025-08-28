import path from 'path'
import hapi from '@hapi/hapi'
import CatboxMemory from '@hapi/catbox-memory'
import inert from '@hapi/inert'
import Jwt from '@hapi/jwt'
import Boom from '@hapi/boom'

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
import { errorHandlerPlugin } from '~/src/api/common/helpers/error-handler.js'
import { nunjucksConfig } from '~/src/config/nunjucks/nunjucks.js'
import { validateJwtAuthentication } from '~/src/api/common/helpers/jwt-auth.js'
import { getAgreementDataById } from './agreement/helpers/get-agreement-data.js'

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

  server.auth.scheme('custom-grants-ui-jwt', () => ({
    authenticate: async (request, h) => {
      const { agreementId } = request.params
      const agreementData = await getAgreementDataById(agreementId)

      if (
        !validateJwtAuthentication(
          request.headers['x-encrypted-auth'],
          agreementData,
          request.logger
        )
      ) {
        throw Boom.unauthorized(
          'Not authorized to accept offer agreement document'
        )
      }

      return h.authenticated({
        credentials: {
          agreementData
        }
      })
    }
  }))
  server.auth.strategy('grants-ui-jwt', 'custom-grants-ui-jwt')

  const options = {
    disableSQS: false,
    ...serverOptions
  }

  // Hapi Plugins:
  // requestLogger      - automatically logs incoming requests
  // requestTracing     - trace header logging and propagation
  // secureContext      - loads CA certificates from environment config
  // pulse              - provides shutdown handlers
  // mongooseDb         - sets up mongoose connection pool and attaches to `server` and `request` objects
  // sqsClientPlugin    - AWS SQS client
  // errorHandlerPlugin - sets up default error handling
  // router             - routes used in the app
  await server.register(
    [
      inert,
      requestLogger,
      requestTracing,
      secureContext,
      pulse,
      mongooseDb,
      nunjucksConfig,
      options.disableSQS ? null : sqsClientPlugin,
      errorHandlerPlugin,
      router
    ].filter(Boolean)
  )

  return server
}

export { createServer }
