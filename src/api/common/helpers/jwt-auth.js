import { config } from '#~/config/index.js'
import Jwt from '@hapi/jwt'
import Boom from '@hapi/boom'

/**
 * Parse the configured comma-separated issuer allow-list into a Set.
 * @param {string} raw - comma-separated "iss" values from config
 * @returns {Set<string>} allow-listed issuers (empty when unset)
 */
const parseAllowedIssuers = (raw) =>
  new Set(
    (raw || '')
      .split(',')
      .map((issuer) => issuer.trim())
      .filter(Boolean)
  )

/**
 * FGP-1307: parse the optional kid-keyed keyring of extra verification secrets.
 * @param {string} raw - JSON object string of { kid: secret }
 * @returns {Record<string, string>} keyring (empty when unset/invalid)
 */
const parseKeyring = (raw) => {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  } catch {
    // fall through to empty keyring
  }

  return {}
}

/**
 * FGP-1307: select the verification secret for a token's kid.
 * Absent kid, or a kid equal to the default kid, uses the default shared secret
 * (so grants-ui, which emits no kid, keeps verifying). Any other kid must be
 * present in the keyring; an unknown kid returns null so the caller rejects the
 * token rather than falling back to the default secret.
 * @param {string|undefined} kid - kid from the token header
 * @param {object} logger - logger for the warn-only no-kid signal
 * @returns {string|null} the secret to verify with, or null for an unknown kid
 */
const resolveSecret = (kid, logger) => {
  const defaultSecret = config.get('jwtSecret')
  const defaultKid = config.get('jwtDefaultKid')
  const keyring = parseKeyring(config.get('jwtKeyring'))

  if (!kid) {
    logger.warn(
      'JWT caller token carried no kid; using the default signing secret'
    )
    return defaultSecret
  }

  if (kid === defaultKid) {
    return defaultSecret
  }

  if (Object.hasOwn(keyring, kid)) {
    return keyring[kid]
  }

  logger.error({ kid }, 'JWT caller token carried an unknown kid')
  return null
}

/**
 * Warn-only claim checks (issuer, audience, expiry). Signature, and expiry
 * when present, are already hard-enforced by Jwt.token.verify; these claims
 * are logged but never reject the request so enforcement can be rolled out
 * in a later stage.
 * @param {object} payload - the verified JWT payload
 * @param {object} logger - logger for the warnings
 */
const warnOnClaimMismatches = (payload, logger) => {
  const allowedIssuers = parseAllowedIssuers(config.get('jwtAllowedIssuers'))

  if (!allowedIssuers.has(payload?.iss)) {
    logger.warn(
      { hasIss: payload?.iss != null },
      'JWT caller token issuer is not in the allow-list; accepted for now'
    )
  }

  const toAudienceList = (aud) => {
    if (Array.isArray(aud)) {
      return aud
    }
    return aud == null ? [] : [aud]
  }
  const audiences = toAudienceList(payload?.aud)
  const expectedAudience = config.get('jwtExpectedAudience')

  if (!audiences.includes(expectedAudience)) {
    logger.warn(
      { hasAud: audiences.length > 0 },
      'JWT caller token audience does not include this service; accepted for now'
    )
  }

  // @hapi/jwt only checks expiry when "exp" is present on the payload, so a
  // token minted without one never expires. Warn-only: still accepted.
  if (payload?.exp == null) {
    logger.warn(
      'JWT caller token carried no expiry (exp) claim; accepted for now'
    )
  }
}

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
    'Attempting to decode JWT token'
  )

  try {
    const decoded = Jwt.token.decode(authToken)
    logger.info('JWT token decoded successfully, attempting verification')

    // FGP-1307: select the verification secret by the token's kid header so we
    // can rotate keys; an unknown kid cannot be verified and is rejected.
    const kid = decoded?.decoded?.header?.kid
    const secret = resolveSecret(kid, logger)
    if (secret == null) {
      return null
    }

    // Verify the token against the resolved secret (also enforces expiry)
    Jwt.token.verify(decoded, {
      key: secret,
      algorithms: ['HS256']
    })

    logger.info('JWT token verified successfully')
    const payload = decoded?.decoded?.payload || null

    if (payload) {
      // FGP-1307: do not log sbi/source (PII); log only presence booleans.
      logger.info(
        {
          hasSbi: !!payload.sbi,
          hasSource: !!payload.source
        },
        'JWT payload extracted'
      )
      warnOnClaimMismatches(payload, logger)
    }

    return payload
  } catch (jwtError) {
    logger.error(jwtError, `Invalid JWT token provided: ${jwtError.message}`)
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

  const jwtSbi = jwtPayload?.sbi == null ? null : String(jwtPayload.sbi)
  const agreementSbi =
    agreementData?.identifiers?.sbi == null
      ? null
      : String(agreementData.identifiers.sbi)

  if (jwtSbi === null && agreementSbi === null) {
    return false
  }

  return Boolean(
    jwtPayload.source === 'defra' &&
      (jwtSbi === agreementSbi || (jwtSbi && !agreementSbi))
  )
}

/**
 * Validates JWT authentication based on feature flag setting
 * @param {string} authToken - The JWT token to verify and decode
 * @param {object} agreementData - The agreement data object
 * @param {object} logger - Logger instance for error reporting
 * @returns {{valid: boolean, source: null, sbi: undefined}} - true if JWT is disabled or JWT validation passes, false otherwise
 */
const validateJwtAuthentication = (authToken, agreementData, logger) => {
  const isJwtEnabled = config.get('featureFlags.isJwtEnabled')

  if (!agreementData && !isJwtEnabled) {
    throw Boom.badRequest(
      'Bad request, Neither JWT is enabled nor agreementId is provided'
    )
  }

  if (isJwtEnabled && !authToken) {
    throw Boom.badRequest(
      'Bad request, JWT is enabled but no auth token provided in the header'
    )
  }

  logger.info(
    {
      isJwtEnabled,
      hasAuthToken: !!authToken,
      authTokenLength: authToken ? authToken.length : 0,
      hasAgreementSbi: agreementData?.identifiers?.sbi != null,
      agreementNumber: agreementData?.agreementNumber
    },
    'JWT Authentication Validation Start'
  )

  if (!isJwtEnabled) {
    logger.warn('JWT authentication is disabled via feature flag')
    return { valid: true, source: null, sbi: null }
  }

  logger.info('JWT authentication is enabled, proceeding with validation')

  const jwtPayload = extractJwtPayload(authToken, logger)
  if (!jwtPayload) {
    logger.info('JWT payload extraction failed')
    return { valid: false, source: null, sbi: null }
  }

  logger.info(
    {
      hasPayloadSbi: jwtPayload.sbi != null,
      hasPayloadSource: jwtPayload.source != null,
      hasAgreementSbi: agreementData?.identifiers?.sbi != null
    },
    'JWT payload extracted successfully'
  )

  const validationResult = verifyJwtPayload(jwtPayload, agreementData)

  logger.info(`JWT payload verification result: ${validationResult}`)

  return {
    valid: validationResult,
    source: jwtPayload?.source ?? null,
    sbi: jwtPayload.sbi
  }
}

export { validateJwtAuthentication }
