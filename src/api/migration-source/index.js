import Joi from 'joi'

import {
  findAgreementNumbersByGrantCode,
  findAgreementVersionPage
} from './source.js'

const auth = 'migration-token'

export const migrationSource = {
  plugin: {
    name: 'migration-source',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/internal/migrations/agreements',
          options: {
            auth,
            validate: {
              query: Joi.object({
                code: Joi.string().trim().min(1).required()
              })
            }
          },
          handler: async (request) => ({
            agreementNumbers: await findAgreementNumbersByGrantCode(
              request.query.code
            )
          })
        },
        {
          method: 'GET',
          path: '/internal/migrations/agreements/{agreementNumber}/versions',
          options: {
            auth,
            validate: {
              params: Joi.object({
                agreementNumber: Joi.string().required()
              }),
              query: Joi.object({
                offset: Joi.number().integer().min(0).default(0)
              })
            }
          },
          handler: (request) =>
            findAgreementVersionPage(
              request.params.agreementNumber,
              request.query.offset
            )
        }
      ])
    }
  }
}
