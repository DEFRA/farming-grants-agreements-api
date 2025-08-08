/**
 * Get the base URL from the request headers
 * @param { import('@hapi/hapi').Request } request
 * @returns { string }
 */
export const getBaseUrl = (request = {}) =>
  request.headers?.['x-base-url'] || '/'
