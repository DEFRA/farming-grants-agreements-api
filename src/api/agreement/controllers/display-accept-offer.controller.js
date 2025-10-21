import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Controller to display the Accept Offer page
 * Renders a Nunjucks template with agreement data (no acceptance logic)
 * @satisfies {Partial<ServerRoute>}
 */
const displayAcceptOfferController = {
  handler: (request, h) => {
    const { agreementData } = request.auth.credentials

    // Render the accept offer template with agreement data
    return h
      .response({
        agreementData
      })
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .code(statusCodes.ok)
  }
}

export { displayAcceptOfferController }
