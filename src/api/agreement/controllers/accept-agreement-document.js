import Boom from '@hapi/boom'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { acceptAgreement } from '~/src/api/agreement/helpers/accept-agreement.js'
import { updatePaymentHub } from '~/src/api/agreement/helpers/update-payment-hub.js'
import { publishMessage } from '~/src/api/common/helpers/sns-publisher.js'

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const acceptAgreementDocumentController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params

      if (!agreementId || agreementId === '') {
        throw Boom.internalServerError('Agreement ID is required')
      }

      request.logger.info('Starting agreement acceptance process', {
        agreementId
      })

      // Accept the agreement
      await acceptAgreement(agreementId)
      request.logger.info('Agreement accepted in database', { agreementId })

      try {
        // Update the payment hub
        await updatePaymentHub(request, agreementId)
        request.logger.info('Payment hub updated', { agreementId })
      } catch (error) {
        request.logger.error('Failed to update payment hub:', {
          error: error.message,
          stack: error.stack,
          agreementId
        })
        throw error
      }

      try {
        // Prepare SNS message
        const snsMessage = {
          type: 'agreement_accepted',
          agreementId,
          timestamp: new Date().toISOString()
        }
        request.logger.info('Preparing to publish SNS message', {
          agreementId,
          message: snsMessage
        })

        // Publish message to SNS
        await publishMessage(snsMessage, request.server)
        request.logger.info('SNS message published successfully', {
          agreementId,
          message: snsMessage
        })
      } catch (error) {
        request.logger.error('Failed to publish SNS message:', {
          error: error.message,
          stack: error.stack,
          agreementId
        })
        throw error
      }

      // Return the HTML response
      return h.response({ message: 'Agreement accepted' }).code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error('Error accepting agreement document:', {
        error: error.message,
        stack: error.stack,
        agreementId: request.params.agreementId
      })
      return h
        .response({
          message: 'Failed to accept agreement document',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { acceptAgreementDocumentController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
