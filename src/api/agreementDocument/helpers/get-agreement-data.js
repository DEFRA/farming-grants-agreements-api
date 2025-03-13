/**
 * Get agreement data for rendering templates
 * @param {string} agreementId - The ID of the agreement to get data for
 * @returns {object} The agreement data
 */
function getAgreementData(agreementId) {
  return {
    AGREEMENTNUMBER: agreementId || 'SFI123456789',
    AGREEMENTNAME: 'Sample Agreement',
    SBI: '123456789',
    COMPANY: 'Sample Farm Ltd',
    ADDRESS: '123 Farm Lane, Farmville',
    POSTCODE: 'FA12 3RM',
    USERNAME: 'John Doe'
  }
}

export { getAgreementData }
