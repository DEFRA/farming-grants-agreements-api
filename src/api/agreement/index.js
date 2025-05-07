import {
  getHTMLAgreementDocumentController,
  acceptAgreementDocumentController,
  unacceptAgreementDocumentController,
  viewAgreementDocumentController
} from '~/src/api/agreement/controllers/index.js'
import { pollQueue } from '~/src/api/events/application-approved-listener.js'
import { createLogger } from '~/src/api/common/helpers/logging/logger.js'
import { config } from '~/src/config/index.js'

const logger = createLogger()
if (!config.get('isTest')) {
  pollQueue().catch((err) => {
    logger.error('❌ Failed to start ApplicationApproved listener:', err)
  })
}

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
