/**
 * Get the base URL from the request headers
 * @param { import('@hapi/hapi').Request } request
 * @returns { string }
 */
export const getContentSecurityPolicyNonce = (request = {}) =>
  request.headers?.['x-csp-nonce'] || 'EDNnf03nceIOfn39fn3e9h3sdfa'
