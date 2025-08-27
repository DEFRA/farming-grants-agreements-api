import { Boom } from '@hapi/boom'
import {
  preFetchAgreement,
  getControllerByAction
} from '~/src/api/agreement/controllers/index.js'

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
          pre: [{ method: preFetchAgreement }]
        },
        /**
         * @param {import('@hapi/hapi').Request & { pre: { agreementData: Agreement } }} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: (request, h) => {
          const payload = request.payload || {}
          const { action } = payload
          const agreementStatus = request.pre.agreementData.status

          const controller = getControllerByAction(agreementStatus)(action)
          if (!controller?.handler) {
            throw Boom.badRequest(
              `Unrecognised action in POST payload: ${String(action)}`
            )
          }

          // Delegate to chosen controller handler
          return controller.handler(request, h)
        }
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
