import {
  postTestQueueMessageController,
  getTestAgreementController
} from '~/src/api/test-endpoints/controllers/index.js'

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
        }
      ])
    }
  }
}

export { testEndpoints }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
