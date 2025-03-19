import { getAgreementController } from '~/src/api/agreement/controllers/index.js'

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const agreement = {
  plugin: {
    name: 'agreement',
    register: (server) => {
      server.route([
        {
          method: 'GET',
          path: '/api/agreement/{agreementId}',
          ...getAgreementController
        }
      ])
    }
  }
}

export { agreement }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
