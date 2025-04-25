import {
  getHTMLAgreementDocumentController,
  acceptAgreementDocumentController,
  unacceptAgreementDocumentController,
  viewAgreementDocumentController
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
          path: '/agreement/{agreementId}',
          ...viewAgreementDocumentController
        },
        {
          method: 'GET',
          path: '/api/agreement/{agreementId}',
          ...getHTMLAgreementDocumentController
        },
        {
          method: 'POST',
          path: '/api/agreement/{agreementId}/accept',
          ...acceptAgreementDocumentController
        },
        {
          method: 'POST',
          path: '/api/agreement/{agreementId}/unaccept',
          ...unacceptAgreementDocumentController
        }
      ])
    }
  }
}

export { agreementDocument }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
