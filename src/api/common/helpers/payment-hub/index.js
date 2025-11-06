import crypto from 'crypto-js'
import { ProxyAgent } from 'undici'
import { config } from '~/src/config/index.js'
import { initCache } from '~/src/api/common/helpers/cache.js'

let cache = null

/**
 * Generate a payment hub token
 * @returns {string} The generated token
 */
const getPaymentHubToken = () => {
  const encoded = encodeURIComponent(config.get('paymentHub.uri'))
  const ttl =
    Math.round(new Date().getTime() / 1000) + config.get('paymentHub.ttl')
  const signature = `${encoded}\n${ttl}`
  const hash = crypto
    .HmacSHA256(signature, config.get('paymentHub.key'))
    .toString(crypto.enc.Base64)
  return `SharedAccessSignature sr=${encoded}&sig=${encodeURIComponent(hash)}&se=${ttl}&skn=${config.get('paymentHub.keyName')}`
}

/**
 * Payment Hub token cache
 * @param { import('@hapi/hapi').Server } server
 * @returns { import('@hapi/catbox').Policy<any, any> }
 */
const getCachedToken = (server) => {
  if (!cache) {
    cache = initCache(server, 'token', getPaymentHubToken, {
      expiresIn: config.get('paymentHub.ttl')
    })
  }
  return cache
}

/**
 * Make fetch requests with proxy support
 * @param {string} url - The URL to fetch
 * @param {object} options - The fetch options
 * @param {string} options.method - The HTTP method (GET, POST, etc.)
 * @param {object} options.headers - The request headers
 * @param {object} options.body - The request body
 * @returns {Promise<Response>} The fetch response
 */
const proxyFetch = (url, options) => {
  const proxyUrlConfig = config.get('httpProxy') // bound to HTTP_PROXY

  if (!proxyUrlConfig) {
    return fetch(url, options)
  }

  return fetch(url, {
    ...options,
    dispatcher: new ProxyAgent({
      uri: proxyUrlConfig,
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    })
  })
}

/**
 * Send a request to the payment hub
 * @param { import('@hapi/hapi').Server } server
 * @param { import('@hapi/hapi').ServerLogger } logger
 * @param { PaymentHubPayload } body
 * @returns {Promise<object>} The response from the payment hub
 */
export const sendPaymentHubRequest = async (server, logger, body) => {
  // Log payload in all environments except production
  logger.info(
    `payment-hub logging enabled ${config.get('isPaymentHubLogging')}`
  )
  if (
    config.get('isPaymentHubLogging') &&
    logger &&
    typeof logger.info === 'function'
  ) {
    logger.info(`Payload to be sent to payment hub: ${JSON.stringify(body)}`)
  }

  if (!config.get('paymentHub.keyName') || !config.get('paymentHub.key')) {
    throw new Error('Payment Hub keyname or key is not set')
  }

  const accessToken = await getCachedToken(server).get('token')
  const brokerProperties = {
    SessionId: '123'
  }

  const url = new URL(`${config.get('paymentHub.uri')}/messages`)
  const response = await proxyFetch(url, {
    method: 'POST',
    headers: {
      Authorization: accessToken,
      'Content-Type': 'application/json',
      BrokerProperties: JSON.stringify(brokerProperties)
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`Payment hub request failed: ${response.statusText}`)
  }

  logger.info('The PaymentHub request sent successfully')

  if (
    config.get('isPaymentHubLogging') &&
    logger &&
    typeof logger.info === 'function'
  ) {
    logger.info(
      `Payment hub response: ${JSON.stringify(response)}. Body: ${JSON.stringify(await response.text())}`
    )
  }

  return {
    status: 'success',
    message: 'Payload sent to payment hub successfully'
  }
}

/** @import { PaymentHubPayload } from '~/src/api/common/types/payment-hub.d.js' */
