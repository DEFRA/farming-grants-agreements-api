import { Decimal128 } from 'mongodb'

function convertDecimal128(obj, seen = new WeakSet()) {
  if (obj == null) return obj

  if (obj instanceof Decimal128) {
    return parseFloat(obj.toString())
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (seen.has(obj)) {
    return obj // prevent infinite loop
  }

  seen.add(obj)

  if (Array.isArray(obj)) {
    return obj.map((item) => convertDecimal128(item, seen))
  }

  for (const key of Object.keys(obj)) {
    obj[key] = convertDecimal128(obj[key], seen)
  }

  return obj
}

/**
 * Hapi plugin for registering the default error handler
 */
export const returnDataHandlerPlugin = {
  name: 'return-data-handler',
  register: (server) => {
    server.ext('onPreResponse', (request, h) => {
      const response = request.response

      // Skip errors or responses without a source
      if (
        response.isBoom ||
        typeof response.source !== 'object' ||
        response.source === null
      ) {
        return h.continue
      }

      response.source.agreement =
        response.source.agreementData || request.auth.credentials?.agreementData
      response.source = convertDecimal128(response.source)

      return h.continue
    })
  }
}
