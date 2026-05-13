import { wmpCreateOffer } from './wmp-create-offer.js'

const wmp = {
  scheme: 'wmp',
  createOffer: wmpCreateOffer,
  buildAgreementWithPayment: (agreementData) => Promise.resolve(agreementData),
  buildPaymentForAcceptance: (agreementData) =>
    Promise.resolve(agreementData.payment)
}

export { wmp }
