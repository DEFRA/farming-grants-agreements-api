import {
  postTestQueueMessageController,
  getTestAgreementController,
  postTestUnacceptOfferController,
  postTestPopulateAgreementsController,
  getTestInvoiceController
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
          path: '/api/test/queue-message/{queueName?}',
          options: {
            tags: ['api', 'test'],
            description: 'Post test queue message',
            notes:
              'Posts a test message to the specified SQS queue for testing.'
          },
          ...postTestQueueMessageController
        },
        {
          method: 'GET',
          path: '/api/test/agreement', // ?agreementNumber=1234567890,12345524566
          options: {
            tags: ['api', 'test'],
            description: 'Get test agreement',
            notes:
              'Retrieves agreement data by agreement number for testing purposes.'
          },
          ...getTestAgreementController
        },
        {
          method: 'POST',
          path: '/api/test/unaccept-offer/{agreementId}',
          options: {
            tags: ['api', 'test'],
            description: 'Unaccept agreement offer',
            notes: 'Reverts an accepted agreement offer back to offered status.'
          },
          ...postTestUnacceptOfferController
        },
        {
          method: 'POST',
          path: '/api/test/populate-agreements',
          options: {
            tags: ['api', 'test'],
            description: 'Populate test agreements',
            notes:
              'Populates the database with sample agreement data for testing.'
          },
          ...postTestPopulateAgreementsController
        },
        {
          method: 'GET',
          path: '/api/test/invoice',
          options: {
            tags: ['api', 'test'],
            description: 'Get test invoice',
            notes: 'Retrieves invoice data for testing purposes.'
          },
          ...getTestInvoiceController
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
            tags: ['api', 'test'],
            description: 'Test unauthorized response',
            notes:
              'Test endpoint to trigger 401 error and return JSON error response.'
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
