import { Boom } from '@hapi/boom'
import { reviewOfferController } from '~/src/api/agreement/controllers/review-offer.controller.js'
import { viewAgreementController } from '~/src/api/agreement/controllers/view-agreement.controller.js'
import { acceptOfferController } from '~/src/api/agreement/controllers/accept-offer.controller.js'
import { displayAcceptOfferController } from '~/src/api/agreement/controllers/display-accept-offer.controller.js'
import { getAgreementDataById } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { validateJwtAuthentication } from '~/src/api/common/helpers/jwt-auth.js'
import { getBaseUrl } from '~/src/api/common/helpers/base-url.js'

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
  } else {
    throw Boom.badRequest(`Agreement is in an unknown state`)
  }

  return chooseControllerByActionOffer
}

export const preFetchAgreement = async (request, h) => {
  const { agreementId } = request.params
  if (!agreementId) return h.continue

  // Get the agreement data before accepting
  const agreementData = await getAgreementDataById(agreementId)

  // Validate JWT authentication based on feature flag
  if (
    !validateJwtAuthentication(
      request.headers['x-encrypted-auth'],
      agreementData,
      request.logger
    )
  ) {
    throw Boom.unauthorized('Not authorized to accept offer agreement document')
  }

  const baseUrl = getBaseUrl(request)

  request.pre = { ...(request.pre || {}), agreementData, baseUrl }

  return h.continue
}
