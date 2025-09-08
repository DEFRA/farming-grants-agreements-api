import { Boom } from '@hapi/boom'
import { getControllerByAction } from '~/src/api/agreement/controllers/index.js'
import { downloadController } from './controllers/download.controller.js'

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const agreement = {
  plugin: {
    name: 'agreement',
    register: (server) => {
      server.route({
        method: ['GET', 'POST'],
        path: '/{agreementId}',
        options: {
          auth: 'grants-ui-jwt'
        },
        /**
         * @param {import('@hapi/hapi').Request & { pre: { agreementData: Agreement } }} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: (request, h) => {
          const payload = request.payload || {}
          const { action } = payload
          const { agreementData } = request.auth.credentials

          const controller = getControllerByAction(agreementData.status)(action)
          if (!controller?.handler) {
            throw Boom.badRequest(
              `Unrecognised action in POST payload: ${String(action)}`
            )
          }

          // Delegate to chosen controller handler
          return controller.handler(request, h)
        }
      })

      server.route({
        method: 'GET',
        path: '/{agreementId}/{version}/download',
        options: {
          auth: 'grants-ui-jwt'
        },
        /**
         * @param {import('@hapi/hapi').Request} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: downloadController
      })
    }
  }
}

export { agreement }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
/**
 * @import { Agreement } from '~/src/api/common/types/agreement.d.js'
 */
