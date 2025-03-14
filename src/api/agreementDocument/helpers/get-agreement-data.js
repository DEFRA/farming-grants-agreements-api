import agreementData from './agreement-data.json'

/**
 * Get agreement data for rendering templates
 * We're currently only using one agreement from a JSON file, so we're not filtering by agreement ID
 * @returns {object} The agreement data
 */
function getAgreementData() {
  // TODO - Get agreement ID from request
  return agreementData
}

export { getAgreementData }
