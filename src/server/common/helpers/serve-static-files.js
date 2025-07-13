import { config } from '~/src/config/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'

const options = {
  auth: false,
  cache: {
    expiresIn: config.get('staticCacheTimeout'),
    privacy: 'private'
  }
}

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
export const serveStaticFiles = {
  plugin: {
    name: 'staticFiles',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/favicon.ico',
          handler(_request, h) {
            return h.response().code(statusCodes.noContent).type('image/x-icon')
          },
          options
        },
        {
          method: 'GET',
          path: `${config.get('assetPath')}/{param*}`,
          handler: {
            directory: {
              path: '.',
              redirectToSlash: true
            }
          },
          options
        },
        {
          method: 'GET',
          path: '/assets/{param*}',
          handler: {
            directory: {
              path: 'assets',
              redirectToSlash: true
            }
          },
          options
        }
      ])
    }
  }
}

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
