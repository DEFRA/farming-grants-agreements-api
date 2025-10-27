import { getAgreementController } from './controllers/get-agreement.controller.js'
import { getAgreementBySBIController } from './controllers/get-agreement-by-sbi.controller.js'
import { acceptOfferController } from './controllers/accept-offer.controller.js'
import { downloadController } from './controllers/download.controller.js'

const auth = 'grants-ui-jwt'

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const agreement = {
  plugin: {
    name: 'agreement',
    register: (server) => {
      server.route({
        method: 'GET',
        path: '/',
        options: { auth },
        /**
         * @param {import('@hapi/hapi').Request & { pre: { agreementData: Agreement } }} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: getAgreementBySBIController
      })

      server.route({
        method: 'GET',
        path: '/{agreementId}',
        options: { auth },
        /**
         * @param {import('@hapi/hapi').Request & { pre: { agreementData: Agreement } }} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: getAgreementController
      })

      server.route({
        method: 'POST',
        path: '/{agreementId}',
        options: { auth },
        /**
         * @param {import('@hapi/hapi').Request & { pre: { agreementData: Agreement } }} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: acceptOfferController
      })

      server.route({
        method: 'GET',
        path: '/{agreementId}/{version}/download',
        options: { auth },
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
