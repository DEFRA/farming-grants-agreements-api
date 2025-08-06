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

  try {
    const decoded = Jwt.token.decode(authToken)
    // Verify the token against the secret
    Jwt.token.verify(decoded, {
      key: config.get('jwtSecret'),
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
  if (jwtPayload == null) {
    return false
  }
  if (jwtPayload?.source === 'entra') {
    return true
  }
  return jwtPayload.source === 'defra' && jwtPayload.sbi === agreementData.sbi
}

export { extractJwtPayload, verifyJwtPayload }
