import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreement } from '~/src/api/agreement/helpers/get-agreement.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const viewAgreementController = {
  handler: async (request, h) => {
    try {
      const { agreementData } = request.auth.credentials

      request.logger.info(
        `Rendering HTML agreement document for agreementNumber: ${agreementData.agreementNumber}`
      )

      // get agreement
      const fullAgreementData = await getAgreement(
        agreementData.agreementNumber,
        agreementData
      )

      const {
        applicant: {
          business: {
            address: {
              line1,
              line2,
              line3,
              line4,
              line5,
              street,
              city,
              postalCode
            } = {}
          } = {}
        } = {}
      } = agreementData

      // Return the HTML response
      return h
        .view('views/sfi-agreement.njk', {
          agreement: fullAgreementData,
          agreementName:
            fullAgreementData.agreementName ||
            'Sustainable Farming Incentive agreement',
          address: [line1, line2, line3, line4, line5, street, city, postalCode]
            .filter(Boolean)
            .join(', ')
        })
        .type('text/html')
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.ok)
    } catch (error) {
      // Let Boom errors pass through to the error handler
      if (error.isBoom) {
        throw error
      }

      request.logger.error(
        error,
        `Error rendering agreement document: ${error.message}`
      )
      request.logger.error(error.stack)
      return h
        .response({
          message: 'Failed to generate agreement document',
          error: error.message
        })
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.internalServerError)
    }
  }
}

export { viewAgreementController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
