import Joi from 'joi'
import { healthController } from '~/src/api/health/controller.js'

const healthResponseSchema = Joi.object({
  message: Joi.string()
    .valid('success')
    .required()
    .description('Health check status message'),
  version: Joi.string()
    .required()
    .description('Current service version from package.json')
}).label('HealthResponse')

const healthErrorResponseSchema = Joi.object({
  message: Joi.string()
    .required()
    .description('Error message describing the health check failure'),
  error: Joi.string().description('Detailed error information'),
  version: Joi.string().description('Current service version from package.json')
}).label('HealthErrorResponse')

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const health = {
  plugin: {
    name: 'health',
    register: (server) => {
      server.route({
        method: 'GET',
        path: '/health',
        options: {
          auth: false,
          tags: ['api', 'health'],
          description: 'Health check endpoint',
          notes:
            'Returns the service health status and version. Used by the platform to verify the service is running. Returns 200 if MongoDB connection is healthy, 503 if unable to connect.',
          response: {
            status: {
              200: healthResponseSchema,
              503: healthErrorResponseSchema
            },
            failAction: 'log'
          }
        },
        ...healthController
      })
    }
  }
}

export { health }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
