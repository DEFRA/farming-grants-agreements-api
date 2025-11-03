import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import { unacceptOffer } from '~/src/api/agreement/helpers/unaccept-offer.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import { config } from '~/src/config/index.js'

/**
 * Controller to accept agreement offer
 * Returns JSON data with agreement information
 * @satisfies {Partial<ServerRoute>}
 */
const acceptOfferController = async (request, h) => {
  // Get the agreement data before accepting
  const { agreementData } = request.auth.credentials
  const { agreementNumber, status } = agreementData

  if (status === 'offered') {
    // Accept the agreement
    const agreementUrl = `${config.get('viewAgreementURI')}/${agreementNumber}`
    await acceptOffer(
      agreementNumber,
      agreementData,
      agreementUrl,
      request.logger
    )

    try {
      // Update the payment hub
      await updatePaymentHub(request, agreementNumber)
    } catch (err) {
      // If payments hub has an error rollback the previous accept offer
      await unacceptOffer(agreementNumber)
      throw err
    }
  }

  // Return JSON response with agreement data
  return h
    .response({ agreementData })
    .header('Cache-Control', 'no-cache, no-store, must-revalidate')
    .code(statusCodes.ok)
}

export { acceptOfferController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
