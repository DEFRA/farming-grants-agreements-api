import {
  getAgreementDocumentController,
  acceptAgreementDocumentController
} from '~/src/api/agreement/controllers/index.js'


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
        },
        {
          method: 'GET',
          path: '/api/agreement/{agreementId}/accept',
          ...acceptAgreementDocumentController
        }
      ])
    }
  }
}

export { agreementDocument }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
