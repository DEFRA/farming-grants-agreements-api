import { wmpCreateOffer } from './wmp-create-offer.js'

const wmp = {
  scheme: 'wmp',
  createOffer: wmpCreateOffer,
  buildAgreementWithPayment: (agreementData) => agreementData,
  buildPaymentForAcceptance: (agreementData) => agreementData.payment
}

export { wmp }
