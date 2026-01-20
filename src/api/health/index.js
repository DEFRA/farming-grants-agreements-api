import { healthController } from '~/src/api/health/controller.js'

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
          tags: ['api', 'health'],
          description: 'Health check endpoint',
          notes:
            'Returns the service health status and version. Used by the platform to verify the service is running.'
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
