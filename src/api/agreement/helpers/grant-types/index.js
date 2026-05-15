import Boom from '@hapi/boom'

import { fptt } from './fptt/fptt-grant.js'
import { wmp } from './wmp/wmp-grant.js'

const grantTypesByCode = {
  woodland: wmp,
  'frps-private-beta': fptt
}

const getGrantTypeByCode = (code) => {
  const normalisedCode = normaliseCode(code)

  if (!normalisedCode) {
    throw Boom.badRequest('Agreement code is required')
  }

  const grantType = grantTypesByCode[normalisedCode]
  if (!grantType) {
    throw Boom.badRequest(`Unknown agreement code: ${code}`)
  }

  return grantType
}

const normaliseCode = (code) =>
  typeof code === 'string' ? code.trim().toLowerCase() : ''

export { getGrantTypeByCode }
