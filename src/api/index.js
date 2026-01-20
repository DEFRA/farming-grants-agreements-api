import hapi from '@hapi/hapi'
import CatboxMemory from '@hapi/catbox-memory'
import Inert from '@hapi/inert'
import Vision from '@hapi/vision'
import HapiSwagger from 'hapi-swagger'

import { config } from '~/src/config/index.js'
import { router } from '~/src/api/router.js'
import { requestLogger } from '~/src/api/common/helpers/logging/request-logger.js'
import { failAction } from '~/src/api/common/helpers/fail-action.js'
import { secureContext } from '~/src/api/common/helpers/secure-context/index.js'
import { pulse } from '~/src/api/common/helpers/pulse.js'
import { requestTracing } from '~/src/api/common/helpers/request-tracing.js'
import { setupProxy } from '~/src/api/common/helpers/proxy/setup-proxy.js'
import { mongooseDb } from '~/src/api/common/helpers/mongoose.js'
import { errorHandlerPlugin } from '~/src/api/common/helpers/error-handler.js'
import { customGrantsUiJwtScheme } from '~/src/api/common/auth/custom-grants-ui-jwt-scheme.js'
import { createSqsClientPlugin } from '~/src/api/common/helpers/sqs-client.js'
import { handleCreateAgreementEvent } from './common/helpers/sqs-message-processor/create-agreement.js'
import { handleUpdateAgreementEvent } from './common/helpers/sqs-message-processor/update-agreement.js'
import { returnDataHandlerPlugin } from './common/helpers/return-data-handler.js'

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

  server.auth.scheme('custom-grants-ui-jwt', customGrantsUiJwtScheme)
  server.auth.strategy('grants-ui-jwt', 'custom-grants-ui-jwt')

  const {
    disableSQS = false,
    mongoUrl,
    mongoDatabase,
    docsOnly = false
  } = serverOptions

  // Hapi Plugins:
  // Inert              - static file serving (required by hapi-swagger)
  // Vision             - template rendering (required by hapi-swagger)
  // HapiSwagger        - OpenAPI spec generation
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
      Inert,
      Vision,
      {
        plugin: HapiSwagger,
        options: {
          info: {
            title: 'Agreement Service API',
            version: '1.0.0',
            description: 'Farming Grants Agreements API'
          },
          documentationPath: '/docs',
          jsonPath: '/docs/openapi.json',
          grouping: 'tags'
        }
      },
      // Skip runtime plugins when only generating docs
      ...(docsOnly
        ? []
        : [
            requestLogger,
            requestTracing,
            secureContext,
            pulse,
            {
              plugin: mongooseDb.plugin,
              options: {
                mongoUrl,
                databaseName: mongoDatabase
              }
            },
            ...(disableSQS
              ? []
              : [
                  createSqsClientPlugin(
                    'gas_create_agreement',
                    config.get('sqs.queueUrl'),
                    handleCreateAgreementEvent
                  ),
                  createSqsClientPlugin(
                    'gas_application_updated',
                    config.get('sqs.gasApplicationUpdatedQueueUrl'),
                    handleUpdateAgreementEvent
                  )
                ]),
            errorHandlerPlugin,
            returnDataHandlerPlugin
          ]),
      router
    ].filter(Boolean)
  )

  return server
}

export { createServer }
