import Joi from 'joi'
import {
  postTestQueueMessageController,
  getTestAgreementController,
  postTestUnacceptOfferController,
  postTestPopulateAgreementsController,
  getTestInvoiceController
} from '~/src/api/test-endpoints/controllers/index.js'
import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import {
  getTestEndpointSchemas,
  getCommonResponseSchemas
} from '~/src/api/common/helpers/joi-schema-from-pact.js'

// Joi schemas for test endpoints (using Pact test data)
const { queueMessagePayload, queueMessageResponse } = getTestEndpointSchemas()
const { agreementArrayResponse } = getCommonResponseSchemas()

const queueMessageParams = Joi.object({
  queueName: Joi.string()
    .optional()
    .default('create_agreement')
    .description(
      'Name of the SQS queue to post the message to (defaults to create_agreement)'
    )
})

const getAgreementQuery = Joi.object({
  id: Joi.alternatives()
    .try(Joi.string(), Joi.array().items(Joi.string()))
    .required()
    .description(
      'Agreement ID(s) to retrieve. Supports comma-delimited values or multiple id params.'
    )
})

const unacceptOfferParams = Joi.object({
  agreementId: Joi.string()
    .required()
    .description(
      'Unique agreement identifier to revert from accepted to offered status'
    )
})

const unacceptOfferResponse = Joi.object({
  message: Joi.string()
    .valid('Offer unaccepted')
    .description('Success confirmation message')
}).label('UnacceptOfferResponse')

const populateAgreementsResponse = Joi.object({
  message: Joi.string().description('Success message'),
  count: Joi.number().integer().description('Number of agreements populated')
}).label('PopulateAgreementsResponse')

const invoiceQuery = Joi.object({
  agreementNumber: Joi.string()
    .required()
    .description('Agreement number to retrieve invoice for')
})

const invoiceResponse = Joi.object({
  agreementNumber: Joi.string().description('Agreement number'),
  invoiceNumber: Joi.string().description('Invoice number'),
  amount: Joi.number().description('Invoice amount'),
  status: Joi.string().description('Invoice status')
})
  .unknown(true)
  .label('InvoiceResponse')

const unauthorizedResponse = Joi.object({
  statusCode: Joi.number()
    .valid(statusCodes.unauthorized)
    .description('HTTP status code'),
  error: Joi.string().valid('Unauthorized').description('Error type'),
  message: Joi.string().description('Error message')
}).label('UnauthorizedResponse')

// Route definitions extracted to reduce register function length
const routes = [
  {
    method: 'POST',
    path: '/api/test/queue-message/{queueName?}',
    options: {
      auth: false,
      tags: ['api', 'test'],
      description: 'Post test queue message',
      notes:
        'Posts a test message to the specified SQS queue for testing. Useful for simulating agreement creation events. For create_agreement queue, returns the created agreement data after processing.',
      validate: {
        params: queueMessageParams,
        payload: queueMessagePayload
      },
      response: {
        schema: queueMessageResponse,
        failAction: 'log'
      }
    },
    ...postTestQueueMessageController
  },
  {
    method: 'GET',
    path: '/api/test/agreement',
    options: {
      auth: false,
      tags: ['api', 'test'],
      description: 'Get test agreement',
      notes:
        'Retrieves agreement data by agreement ID for testing purposes. Supports multiple IDs via comma-delimited values or repeated query params (e.g. ?id=123,456 or ?id=123&id=456).',
      validate: {
        query: getAgreementQuery
      },
      response: {
        schema: agreementArrayResponse,
        failAction: 'log'
      }
    },
    ...getTestAgreementController
  },
  {
    method: 'POST',
    path: '/api/test/unaccept-offer/{agreementId}',
    options: {
      auth: false,
      tags: ['api', 'test'],
      description: 'Unaccept agreement offer',
      notes:
        'Reverts an accepted agreement offer back to offered status. This is a test-only endpoint for resetting agreement state during testing.',
      validate: {
        params: unacceptOfferParams
      },
      response: {
        schema: unacceptOfferResponse,
        failAction: 'log'
      }
    },
    ...postTestUnacceptOfferController
  },
  {
    method: 'POST',
    path: '/api/test/populate-agreements',
    options: {
      auth: false,
      tags: ['api', 'test'],
      description: 'Populate test agreements',
      notes:
        'Populates the database with sample agreement data for testing. Creates predefined test agreements that can be used in integration tests.',
      response: {
        schema: populateAgreementsResponse,
        failAction: 'log'
      }
    },
    ...postTestPopulateAgreementsController
  },
  {
    method: 'GET',
    path: '/api/test/invoice',
    options: {
      auth: false,
      tags: ['api', 'test'],
      description: 'Get test invoice',
      notes:
        'Retrieves invoice data by agreement number for testing purposes. Returns the invoice document from the database.',
      validate: {
        query: invoiceQuery
      },
      response: {
        schema: invoiceResponse,
        failAction: 'log'
      }
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
        'Test endpoint that always returns a 401 Unauthorized error. Useful for testing error handling and JSON error response formatting in clients.',
      response: {
        status: {
          [statusCodes.unauthorized]: unauthorizedResponse
        },
        failAction: 'log'
      }
    }
  }
]

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const testEndpoints = {
  plugin: {
    name: 'testEndpoints',
    register: (server) => {
      server.route(routes)
    }
  }
}

export { testEndpoints }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
