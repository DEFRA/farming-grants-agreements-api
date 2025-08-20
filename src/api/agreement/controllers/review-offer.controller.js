import path from 'node:path'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementDataById } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { getBaseUrl } from '~/src/api/common/helpers/base-url.js'
import { validateJwtAuthentication } from '~/src/api/common/helpers/jwt-auth.js'
import { config } from '~/src/config/index.js'
import Boom from '@hapi/boom'

/**
 * Flatten parcel activities to get land parcel and quantity
 * @param {object} agreementData
 * @returns {*[]} actions
 */
function flattenParcelActivities(agreementData) {
  const actions = []
  ;(agreementData.parcels || []).forEach((parcel) => {
    ;(parcel.activities ?? []).forEach((activity) => {
      actions.push({
        name:
          agreementData.actions?.find((a) => a.code === activity.code)?.title ??
          activity.code,
        code: activity.code,
        landParcel: parcel.parcelNumber,
        quantity: activity.area
      })
    })
  })
  return actions
}

/**
 * Controller to serve the View Offer page
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */
const reviewOfferController = {
  handler: async (request, h) => {
    try {
      const { agreementId } = request.params
      const baseUrl = getBaseUrl(request)

      // Add JWT debugging logging
      const isJwtEnabled = config.get('featureFlags.isJwtEnabled')
      const jwtSecret = config.get('jwtSecret')
      const authHeader = request.headers['x-encrypted-auth']

      request.logger.info('JWT Debug Info:', {
        agreementId,
        isJwtEnabled,
        hasJwtSecret: !!jwtSecret,
        jwtSecretLength: jwtSecret ? jwtSecret.length : 0,
        hasAuthHeader: !!authHeader,
        authHeaderLength: authHeader ? authHeader.length : 0,
        authHeaderPreview: authHeader
          ? `${authHeader.substring(0, 20)}...`
          : 'none'
      })

      // Add clear token presence logging
      if (authHeader) {
        request.logger.info('✅ JWT TOKEN IS PRESENT:', {
          tokenLength: authHeader.length,
          isJwtFormat: authHeader.startsWith('eyJ') && authHeader.includes('.')
        })
      } else {
        request.logger.warn('❌ NO JWT TOKEN PRESENT - Auth header missing')
      }

      // Log all headers for debugging
      request.logger.info('All request headers:', Object.keys(request.headers))

      // Get the agreement data
      const agreementData = await getAgreementDataById(agreementId)

      // Validate JWT authentication based on feature flag
      const jwtValidationResult = validateJwtAuthentication(
        request.headers['x-encrypted-auth'],
        agreementData,
        request.logger
      )

      request.logger.info('🔐 JWT Validation Result:', {
        passed: jwtValidationResult,
        agreementId,
        isJwtEnabled
      })

      if (!jwtValidationResult) {
        request.logger.error('❌ JWT Validation FAILED - Throwing 401 error')
        throw Boom.unauthorized(
          'Not authorized to review offer agreement document'
        )
      } else {
        request.logger.info(
          '✅ JWT Validation PASSED - Proceeding with request'
        )
      }

      if (agreementData.status === 'accepted') {
        return h.redirect(path.join(baseUrl, 'offer-accepted', agreementId))
      }

      const actions = flattenParcelActivities(agreementData)

      // Map payments
      const payments = (agreementData.payments?.activities || []).map(
        (payment) => ({
          name: payment.description || payment.code,
          code: payment.code,
          rate: payment.rate,
          yearly: payment.annualPayment
        })
      )

      // Calculate totalYearly as the sum of the displayed payments
      const totalYearly = payments.reduce(
        (sum, payment) => sum + (payment.yearly || 0),
        0
      )

      // Calculate totalQuarterly as the sum of the displayed quarterly payments
      const totalQuarterly = payments.reduce(
        (sum, payment) => sum + (payment.yearly || 0) / 4,
        0
      )

      // Render the page with base context automatically applied
      return h
        .view('views/view-offer.njk', {
          agreementStatus: agreementData.status,
          agreementNumber: agreementData.agreementNumber,
          agreementSignatureDate: agreementData.signatureDate,
          company: agreementData.company,
          sbi: agreementData.sbi,
          farmerName: agreementData.username,
          actions,
          payments,
          totalYearly,
          totalQuarterly
        })
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .code(statusCodes.ok)
    } catch (error) {
      // Let Boom errors pass through to the error handler
      if (error.isBoom) {
        throw error
      }

      request.logger.error(`Error fetching offer: ${error.message}`)
      return h
        .response({
          message: 'Failed to fetch offer',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { reviewOfferController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
