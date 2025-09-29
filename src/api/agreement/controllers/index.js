import Boom from '@hapi/boom'
import { reviewOfferController } from '~/src/api/agreement/controllers/review-offer.controller.js'
import { viewAgreementController } from '~/src/api/agreement/controllers/view-agreement.controller.js'
import { acceptOfferController } from '~/src/api/agreement/controllers/accept-offer.controller.js'
import { displayAcceptOfferController } from '~/src/api/agreement/controllers/display-accept-offer.controller.js'
import { offerWithdrawnController } from '~/src/api/agreement/controllers/offer-withdrawn.controller.js'

export const getControllerByAction = (agreementStatus) => {
  let chooseControllerByActionOffer
  if (agreementStatus === 'offered') {
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
  } else if (agreementStatus === 'accepted') {
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
  } else if (agreementStatus === 'withdrawn') {
    chooseControllerByActionOffer = () => offerWithdrawnController
  } else {
    throw Boom.badRequest(`Agreement is in an unknown state`)
  }

  return chooseControllerByActionOffer
}
