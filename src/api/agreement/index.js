import Joi from 'joi'
import { getAgreementController } from './controllers/get-agreement.controller.js'
import { acceptOfferController } from './controllers/accept-offer.controller.js'
import { downloadController } from './controllers/download.controller.js'
import { getCommonResponseSchemas } from '~/src/api/common/helpers/joi-schema-from-pact.js'

const auth = 'grants-ui-jwt'

// Joi schemas for agreement endpoints (using Pact test data)
const { agreementResponse, acceptOfferResponse } = getCommonResponseSchemas()

const agreementIdParam = Joi.object({
  agreementId: Joi.string()
    .required()
    .description('Unique agreement identifier (e.g. SFI123456789)')
})

const downloadParams = Joi.object({
  agreementId: Joi.string()
    .required()
    .description('Unique agreement identifier (e.g. SFI123456789)'),
  version: Joi.number()
    .integer()
    .min(1)
    .required()
    .description('Agreement version number (starts at 1)')
})

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const agreement = {
  plugin: {
    name: 'agreement',
    register: (server) => {
      server.route({
        method: 'GET',
        path: '/',
        options: {
          auth,
          tags: ['api', 'agreement'],
          description: 'Get current user agreement',
          notes:
            'Returns agreement data for the authenticated user based on JWT credentials. The user must be authenticated via the Grants UI JWT token (DefraID or Entra).',
          response: {
            schema: agreementResponse,
            failAction: 'log'
          }
        },
        /**
         * @param {import('@hapi/hapi').Request & { pre: { agreementData: Agreement } }} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: getAgreementController({ allowEntra: false })
      })

      server.route({
        method: 'POST',
        path: '/',
        options: {
          auth,
          tags: ['api', 'agreement'],
          description: 'Accept agreement offer',
          notes:
            'Accepts the agreement offer for the authenticated user. This endpoint updates the payment hub, records the signature date, and publishes a status update event to SNS. Only agreements with status "offered" can be accepted.',
          response: {
            schema: acceptOfferResponse,
            failAction: 'log'
          }
        },
        /**
         * @param {import('@hapi/hapi').Request & { pre: { agreementData: Agreement } }} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: acceptOfferController
      })

      server.route({
        method: 'GET',
        path: '/{agreementId}',
        options: {
          auth,
          tags: ['api', 'agreement'],
          description: 'Get agreement by ID',
          notes:
            'Returns agreement data for the specified agreement ID. This endpoint supports both DefraID and Entra authentication methods.',
          validate: {
            params: agreementIdParam
          },
          response: {
            schema: agreementResponse,
            failAction: 'log'
          }
        },
        /**
         * @param {import('@hapi/hapi').Request & { pre: { agreementData: Agreement } }} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: getAgreementController({ allowEntra: true })
      })

      server.route({
        method: 'GET',
        path: '/{agreementId}/{version}/download',
        options: {
          auth,
          tags: ['api', 'agreement'],
          description: 'Download agreement PDF',
          notes:
            'Downloads the agreement PDF document for the specified agreement ID and version from S3. The PDF filename follows the pattern {agreementId}-{version}.pdf.',
          validate: {
            params: downloadParams
          }
        },
        /**
         * @param {import('@hapi/hapi').Request} request
         * @param {import('@hapi/hapi').ResponseToolkit} h
         */
        handler: downloadController
      })
    }
  }
}

export { agreement }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
/**
 * @import { Agreement } from '~/src/api/common/types/agreement.d.js'
 */
