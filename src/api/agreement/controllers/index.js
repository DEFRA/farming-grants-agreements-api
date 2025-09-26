import Boom from '@hapi/boom'
import { reviewOfferController } from '~/src/api/agreement/controllers/review-offer.controller.js'
import { viewAgreementController } from '~/src/api/agreement/controllers/view-agreement.controller.js'
import { acceptOfferController } from '~/src/api/agreement/controllers/accept-offer.controller.js'
import { displayAcceptOfferController } from '~/src/api/agreement/controllers/display-accept-offer.controller.js'
import { offerWithdrawnController } from '~/src/api/agreement/controllers/offer-withdrawn.controller.js'

export const getControllerByAction = (agreementStatus) => {
  let chooseControllerByActionOffer
  switch (agreementStatus) {
    case 'offered':
      chooseControllerByActionOffer = (action) => {
        switch (action) {
          case 'display-accept':
            return displayAcceptOfferController
          case 'accept-offer':
            return acceptOfferController
          case 'review-offer':
          default:
            return reviewOfferController
        }
      }
      break

    case 'accepted':
      chooseControllerByActionOffer = (action) => {
        switch (action) {
          case 'view-agreement':
            return viewAgreementController
          case 'accept-offer':
          case 'offer-accepted':
          default:
            return acceptOfferController
        }
      }
      break

    case 'withdrawn':
      chooseControllerByActionOffer = () => offerWithdrawnController
      break

    default:
      throw Boom.badRequest(`Agreement is in an unknown state`)
  }

  return chooseControllerByActionOffer
}
