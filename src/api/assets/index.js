import { serveAssetsController } from '~/src/api/assets/controllers/index.js'

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const assets = {
  plugin: {
    name: 'assets',
    register: (server) => {
      server.route([
        {
          method: 'GET',
          path: '/assets/{param*}',
          ...serveAssetsController
        }
      ])
    }
  }
}

export { assets }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
