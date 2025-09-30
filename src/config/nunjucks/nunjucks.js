import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import nunjucks from 'nunjucks'
import hapiVision from '@hapi/vision'

import { config } from '~/src/config/index.js'
import { context } from './context/context.js'
import * as filters from './filters/filters.js'
import * as globals from './globals.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
export const uiPaths = [
  path.resolve(dirname, '../../server/common/templates'),
  path.resolve(dirname, '../../server/common/components')
]
const nunjucksEnvironment = nunjucks.configure(
  ['node_modules/govuk-frontend/dist/', ...uiPaths],
  {
    autoescape: true,
    throwOnUndefined: false,
    trimBlocks: true,
    lstripBlocks: true,
    watch: config.get('nunjucks.watch'),
    noCache: config.get('nunjucks.noCache')
  }
)

const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/assets-manifest.json'
)

let webpackManifest
try {
  webpackManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
} catch (error) {
  // Manifest file not found, continue without it
  webpackManifest = {}
}

/**
 * @param {string} baseUrl
 * @param {string} asset
 * @returns {string}
 */
const getAssetPath = (baseUrl, asset) => {
  const webpackAssetPath = webpackManifest?.[asset]
  return path.join(baseUrl, assetPath, webpackAssetPath ?? asset)
}

const buildUrl = (...args) => path.join(...args)

nunjucksEnvironment.addGlobal('getAssetPath', getAssetPath)
nunjucksEnvironment.addGlobal('buildUrl', buildUrl)
nunjucksEnvironment.addGlobal('govukRebrand', true)
const gaTrackingId = config.get('googleAnalytics.trackingId')
nunjucksEnvironment.addGlobal('gaTrackingId', String(gaTrackingId ?? ''))

/**
 * @satisfies {ServerRegisterPluginObject<ServerViewsConfiguration>}
 */
export const nunjucksConfig = {
  plugin: hapiVision,
  options: {
    engines: {
      njk: {
        /**
         * @param {string} src
         * @param {{ environment: typeof nunjucksEnvironment }} options
         * @returns {(options: ReturnType<Awaited<typeof context>>) => string}
         */
        compile(src, options) {
          const template = nunjucks.compile(src, options.environment)
          return (ctx) => template.render(ctx)
        }
      }
    },
    compileOptions: {
      environment: nunjucksEnvironment
    },
    relativeTo: path.resolve(dirname, '../..'),
    path: 'server/common/templates',
    isCached: config.get('isProduction'),
    context
  }
}

Object.entries(globals).forEach(([name, global]) => {
  nunjucksEnvironment.addGlobal(name, global)
})

Object.entries(filters).forEach(([name, filter]) => {
  nunjucksEnvironment.addFilter(name, filter)
})

export { nunjucksEnvironment }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 * @import { ServerViewsConfiguration } from '@hapi/vision'
 */
