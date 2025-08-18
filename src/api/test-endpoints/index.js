import {
  postTestQueueMessageController,
  getTestAgreementController
} from '~/src/api/test-endpoints/controllers/index.js'
import Boom from '@hapi/boom'

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const testEndpoints = {
  plugin: {
    name: 'testEndpoints',
    register: (server) => {
      server.route([
        {
          method: 'POST',
          path: '/api/test/queue-message',
          ...postTestQueueMessageController
        },
        {
          method: 'GET',
          path: '/api/test/agreement', // ?agreementNumber=1234567890,12345524566
          ...getTestAgreementController
        },
        {
          method: 'GET',
          path: '/api/test/unauthorized',
          handler: () => {
            // Simulate a 401 Unauthorized error using Boom
            throw Boom.unauthorized('Test unauthorized error')
          },
          options: {
            auth: false,
            description:
              'Test endpoint to trigger 401 error and render unauthorized template'
          }
        }
      ])
    }
  }
}

export { testEndpoints }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
