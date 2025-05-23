import { health } from '~/src/api/health/index.js'
import { agreementDocument } from '~/src/api/agreement/index.js'
import { assets } from '~/src/api/assets/index.js'
import { testEndpoints } from '~/src/api/test-endpoints/index.js'
import { config } from '~/src/config/index.js'

/**
 * @satisfies { import('@hapi/hapi').ServerRegisterPluginObject<*> }
 */
const router = {
  plugin: {
    name: 'Router',
    register: async (server) => {
      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Application specific routes, add your own routes here.
      await server.register([agreementDocument, assets])

      if (config.get('featureFlags.testEndpoints') === true) {
        await server.register([testEndpoints])
      }
    }
  }
}

export { router }
