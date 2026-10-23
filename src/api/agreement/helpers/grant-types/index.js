import Boom from '@hapi/boom'

import { fptt } from './fptt/fptt-grant.js'

const grantTypesByCode = {
  'frps-private-beta': fptt
}

const getSupportedGrantCodes = () => Object.keys(grantTypesByCode)

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

export { getGrantTypeByCode, getSupportedGrantCodes }
