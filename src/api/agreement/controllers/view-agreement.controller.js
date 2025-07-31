import { config } from '~/src/config/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import Jwt from '@hapi/jwt'

/**
 * Validates and verifies a JWT token against a secret to extract the payload
 * which will have the 'sbi' and 'source' data
 *
 * @param {string} authToken - The JWT token to verify and decode
 * @param {object} logger - Logger instance for error reporting
 * @returns {payload|null} The JWT payload object from the token or null if invalid/missing
 */
const extractPayload = (authToken, logger) => {
  if (!authToken || authToken.trim() === '') {
    logger.error('No JWT token provided')
    return null
  }

  try {
    const decoded = Jwt.token.decode(authToken)
    // Verify the token against the secret
    Jwt.token.verify(decoded, {
      key: config.get('jwtToken'),
      algorithms: ['HS256']
    })
    return decoded?.decoded?.payload || null
  } catch (jwtError) {
    logger.error(`Invalid JWT token provided: ${jwtError.message}`)
    logger.error(jwtError.stack)
    return null
  }
}

/**
 *
 * @param {object} jwtPayload - The Jwt Auth payload, that has 'sbi' and 'source'
 * @param {object} agreementData - The agreement data object
 * @returns {boolean} - if the auth payload could be verified against the sbi from the agreementData
 */
const verifyJwtPayload = (jwtPayload, agreementData) => {
  if (jwtPayload?.source === 'entra') {
    return true
  }
  return jwtPayload.source === 'defra' && jwtPayload.sbi === agreementData.sbi
}

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const viewAgreementController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params

      // Extract SBI from JWT token
      const jwtPayload = extractPayload(
        request.headers['x-encrypted-auth'],
        request.logger
      )

      const agreementData = await getAgreementData({
        agreementNumber: agreementId
      })
      if (!jwtPayload || !verifyJwtPayload(jwtPayload, agreementData)) {
        return h
          .response({
            message: 'Not authorized to view offer agreement document'
          })
          .code(statusCodes.unauthorized)
      }

      request.logger.info(
        `Rendering HTML agreement document for agreementId: ${agreementId}`
      )

      // get HTML agreement
      const renderedHtml = await getHTMLAgreementDocument(
        agreementId,
        agreementData,
        request.headers['defra-grants-proxy'] === 'true'
      )

      // Return the HTML response
      return h.response(renderedHtml).type('text/html').code(statusCodes.ok)
    } catch (error) {
      request.logger.error(
        `Error rendering agreement document: ${error.message}`
      )
      request.logger.error(error.stack)
      return h
        .response({
          message: 'Failed to generate agreement document',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { viewAgreementController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
