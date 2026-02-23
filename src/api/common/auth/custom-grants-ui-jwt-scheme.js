import Boom from '@hapi/boom'

import { validateJwtAuthentication } from '#~/api/common/helpers/jwt-auth.js'
import {
  getAgreementDataById,
  getAgreementDataBySbi
} from '#~/api/agreement/helpers/get-agreement-data.js'

const customGrantsUiJwtScheme = () => ({
  authenticate: async (request, h) => {
    const { agreementId } = request.params || {}
    let agreementData = null

    if (agreementId) {
      agreementData = await getAgreementDataById(agreementId)
    }

    const authResult = validateJwtAuthentication(
      request.headers['x-encrypted-auth'],
      agreementData,
      request.logger
    )

    if (!authResult.valid) {
      throw Boom.unauthorized(
        'Not authorized to view/accept offer agreement document'
      )
    }
    // Getting Agreement of the farmer based on the SBI number as agreementId not provided
    if (!agreementData && checkAuthSourceAndSbi(authResult)) {
      agreementData = await getAgreementDataBySbi(authResult.sbi)
    }

    return h.authenticated({
      credentials: {
        agreementData,
        source: authResult.source
      }
    })
  }
})

function checkAuthSourceAndSbi(auth) {
  return typeof auth.source === 'string' && auth.source === 'defra' && auth.sbi
}

export { customGrantsUiJwtScheme }
