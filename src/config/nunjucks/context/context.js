import { readFileSync } from 'node:fs'
import path from 'node:path'

import { config } from '~/src/config/index.js'
import { buildNavigation } from '~/src/config/nunjucks/context/build-navigation.js'
import { createLogger } from '~/src/api/common/helpers/logging/logger.js'
import { getBaseUrl } from '~/src/api/common/helpers/base-url.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/assets-manifest.json'
)

/** @type {Record<string, string> | undefined} */
let webpackManifest

/**
 * @param {Request | null} request
 */
export function context(request) {
  const tempSbi = 106284736 // Temporary SBI for unauthenticated users

  if (!webpackManifest) {
    try {
      webpackManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(`Webpack ${path.basename(manifestPath)} not found`)
    }
  }

  const session = request?.auth?.isAuthenticated ? request.auth.credentials : {}
  const auth = {
    isAuthenticated: request?.auth?.isAuthenticated ?? false,
    sbi: session.sbi || tempSbi,
    name: config.get('featureFlags.isJwtEnabled')
      ? session.name
      : 'Unauthenticated user',
    organisationId: session.organisationId,
    role: session.role
  }

  return {
    baseUrl: getBaseUrl(request),
    assetPath: `${assetPath}/assets/rebrand`,
    serviceName: config.get('serviceName'),
    serviceTitle: config.get('serviceTitle'),
    auth,
    breadcrumbs: [],
    navigation: buildNavigation(request)
  }
}

/**
 * @import { Request } from '@hapi/hapi'
 */
