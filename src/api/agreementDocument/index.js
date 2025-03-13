import { getAgreementDocumentController } from '~/src/api/agreementDocument/controllers/index.js'

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const agreementDocument = {
  plugin: {
    name: 'agreementDocument',
    register: (server) => {
      server.route([
        {
          method: 'GET',
          path: '/api/agreement/{agreementId}',
          ...getAgreementDocumentController
        }
      ])
    }
  }
}

export { agreementDocument }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
