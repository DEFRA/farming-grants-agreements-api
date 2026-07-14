import { config } from '#~/config/index.js'
import { calculateWmpPaymentDates } from '#~/api/adapter/land-grants-adapter.js'

const getWmpCalculationUri = () =>
  String(config.get('landGrants.calculationUris.wmp'))

const calculateWmpAgreementDates = (requestData, logger, correlationId) =>
  calculateWmpPaymentDates(requestData, logger, {
    calculationUri: getWmpCalculationUri(),
    correlationId
  })

export { calculateWmpAgreementDates }
