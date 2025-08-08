import {
  reviewOfferController,
  viewAgreementController,
  createOfferController,
  acceptOfferController,
  unacceptOfferController,
  displayAcceptOfferController
} from '~/src/api/agreement/controllers/index.js'

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const agreement = {
  plugin: {
    name: 'agreement',
    register: (server) => {
      server.route([
        {
          method: 'GET',
          path: '/review-offer/{agreementId}',
          ...reviewOfferController
        },
        {
          method: 'GET',
          path: '/review-accept-offer/{agreementId}',
          ...displayAcceptOfferController
        },
        {
          method: 'GET',
          path: '/view-agreement/{agreementId}',
          ...viewAgreementController
        },
        {
          method: 'POST',
          path: '/create-offer',
          ...createOfferController
        },
        {
          method: 'POST',
          path: '/accept-offer/{agreementId?}',
          ...acceptOfferController
        },
        {
          method: 'GET',
          path: '/offer-accepted/{agreementId}',
          ...acceptOfferController
        },
        {
          method: 'POST',
          path: '/unaccept-offer/{agreementId}',
          ...unacceptOfferController
        }
      ])
    }
  }
}

export { agreement }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
