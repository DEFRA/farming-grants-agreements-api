import { config } from '~/src/config/index.js'
import Jwt from '@hapi/jwt'

/**
 * Validates and verifies a JWT token against a secret to extract the payload
 * which will have the 'sbi' and 'source' data
 * @param {string} authToken - The JWT token to verify and decode
 * @param {object} logger - Logger instance for error reporting
 * @returns {payload|null} The JWT payload object from the token or null if invalid/missing
 */
const extractJwtPayload = (authToken, logger) => {
  if (!authToken || authToken.trim() === '') {
    logger.error('No JWT token provided')
    return null
  }

  logger.info(
    {
      tokenLength: authToken.length,
      isJwtFormat: authToken.startsWith('eyJ') && authToken.includes('.')
    },
    'Attempting to decode JWT token:'
  )

  try {
    const decoded = Jwt.token.decode(authToken)
    logger.info('JWT token decoded successfully, attempting verification')

    // Verify the token against the secret
    Jwt.token.verify(decoded, {
      key: config.get('jwtSecret'),
      algorithms: ['HS256']
    })

    logger.info('JWT token verified successfully')
    const payload = decoded?.decoded?.payload || null

    if (payload) {
      logger.info(
        {
          hasSbi: !!payload.sbi,
          hasSource: !!payload.source,
          source: payload.source
        },
        'JWT payload extracted:'
      )
    }

    return payload
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
  if (jwtPayload == null) {
    return false
  }

  if (jwtPayload?.source === 'entra') {
    return true
  }

  const result =
    jwtPayload.source === 'defra' && jwtPayload.sbi === agreementData.sbi

  return result
}

/**
 * Validates JWT authentication based on feature flag setting
 * @param {string} authToken - The JWT token to verify and decode
 * @param {object} agreementData - The agreement data object
 * @param {object} logger - Logger instance for error reporting
 * @returns {boolean} - true if JWT is disabled or JWT validation passes, false otherwise
 */
const validateJwtAuthentication = (authToken, agreementData, logger) => {
  const isJwtEnabled = config.get('featureFlags.isJwtEnabled')

  logger.info(
    {
      isJwtEnabled,
      hasAuthToken: !!authToken,
      authTokenLength: authToken ? authToken.length : 0,
      agreementSbi: agreementData?.sbi,
      agreementNumber: agreementData?.agreementNumber
    },
    'JWT Authentication Validation Start:'
  )

  if (!isJwtEnabled) {
    logger.info('JWT authentication is disabled via feature flag')
    return true
  }

  logger.info('JWT authentication is enabled, proceeding with validation')

  const jwtPayload = extractJwtPayload(authToken, logger)
  if (!jwtPayload) {
    logger.info('JWT payload extraction failed')
    return false
  }

  logger.info(
    {
      payloadSbi: jwtPayload.sbi,
      payloadSource: jwtPayload.source,
      agreementSbi: agreementData?.sbi
    },
    'JWT payload extracted successfully:'
  )

  const validationResult = verifyJwtPayload(jwtPayload, agreementData)
  logger.info(validationResult, 'JWT payload verification result:')

  return validationResult
}

export { extractJwtPayload, verifyJwtPayload, validateJwtAuthentication }
