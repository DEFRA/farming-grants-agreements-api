import { getAgreementController } from './controllers/get-agreement.controller.js'
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
        options: {
          auth,
          tags: ['api', 'agreement'],
          description: 'Get current user agreement',
          notes:
            'Returns agreement data for the authenticated user based on JWT credentials.'
        },
        /**
         * @param {import('@hapi/hapi').Request & { pre: { agreementData: Agreement } }} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: getAgreementController({ allowEntra: false })
      })

      server.route({
        method: 'POST',
        path: '/',
        options: {
          auth,
          tags: ['api', 'agreement'],
          description: 'Accept agreement offer',
          notes:
            'Accepts the agreement offer for the authenticated user. Updates payment hub and publishes status update event.'
        },
        /**
         * @param {import('@hapi/hapi').Request & { pre: { agreementData: Agreement } }} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: acceptOfferController
      })

      server.route({
        method: 'GET',
        path: '/{agreementId}',
        options: {
          auth,
          tags: ['api', 'agreement'],
          description: 'Get agreement by ID',
          notes:
            'Returns agreement data for the specified agreement ID. Allows Entra authentication.'
        },
        /**
         * @param {import('@hapi/hapi').Request & { pre: { agreementData: Agreement } }} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: getAgreementController({ allowEntra: true })
      })

      server.route({
        method: 'GET',
        path: '/{agreementId}/{version}/download',
        options: {
          auth,
          tags: ['api', 'agreement'],
          description: 'Download agreement PDF',
          notes:
            'Downloads the agreement PDF document for the specified agreement ID and version from S3.'
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
