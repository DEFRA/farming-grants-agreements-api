import {
  getAgreementDocumentController,
  acceptAgreementDocumentController
} from '~/src/api/agreement/controllers/index.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
          method: 'POST',
          path: '/api/agreement/{agreementId}/accept',
          ...acceptAgreementDocumentController
        },
        {
          method: 'GET',
          path: '/api/agreement/helpers/agreement.js',
          handler: (request, h) => {
            const filePath = path.join(__dirname, 'helpers', 'agreement.js')
            const content = fs.readFileSync(filePath, 'utf8')
            return h.response(content).type('application/javascript')
          }
        }
      ])
    }
  }
}

export { agreementDocument }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
