import { fpttCreateOffer } from './fptt-create-offer.js'
import { fpttBuildAcceptedPayment } from './fptt-accept-offer.js'
import { fpttGetPayment } from './fptt-get-agreement.js'

const fptt = {
  scheme: 'fptt',
  createOffer: fpttCreateOffer,
  buildAgreementWithPayment: async (agreementData, logger) => {
    const payment = await fpttGetPayment(agreementData, logger)
    return { ...agreementData, payment }
  },
  buildPaymentForAcceptance: fpttBuildAcceptedPayment
}

export { fptt }
