import Joi from 'joi'

import {
  findWoodlandAgreementNumbers,
  findWoodlandAgreementVersionPage
} from './source.js'

const auth = 'migration-token'

export const woodlandMigration = {
  plugin: {
    name: 'woodland-migration',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/internal/migrations/woodland/agreements',
          options: { auth },
          handler: async () => ({
            agreementNumbers: await findWoodlandAgreementNumbers()
          })
        },
        {
          method: 'GET',
          path: '/internal/migrations/woodland/agreements/{agreementNumber}/versions',
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
            findWoodlandAgreementVersionPage(
              request.params.agreementNumber,
              request.query.offset
            )
        }
      ])
    }
  }
}
