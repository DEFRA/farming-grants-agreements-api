import { wmpCreateOffer } from './wmp-create-offer.js'
import { wmpBuildAcceptedPayment } from './wmp-accept-offer.js'

const wmp = {
  scheme: 'wmp',
  createOffer: wmpCreateOffer,
  buildAgreementWithPayment: (agreementData) => agreementData,
  buildPaymentForAcceptance: wmpBuildAcceptedPayment
}

export { wmp }
