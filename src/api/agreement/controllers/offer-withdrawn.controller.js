import { statusCodes } from '~/src/api/common/constants/status-codes.js'

/**
 * Controller to display the Offer withdrawn page
 * @satisfies {Partial<ServerRoute>}
 */
const offerWithdrawnController = {
  handler: (request, h) => {
    const { agreementData } = request.auth.credentials

    return h
      .response({ agreementData })
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .code(statusCodes.ok)
  }
}

export { offerWithdrawnController }
