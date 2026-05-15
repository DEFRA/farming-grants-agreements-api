import { config } from '#~/config/index.js'
import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'

const DEFAULT_FPTT_CALCULATION_URI = '/api/v2/payments/calculate'

const getConfigString = (key) => String(config.get(key))

const getFpttCalculationUri = () => {
  const legacyCalculationUri = getConfigString('landGrants.calculationUri')
  const fpttCalculationUri = getConfigString('landGrants.calculationUris.fptt')

  return fpttCalculationUri === DEFAULT_FPTT_CALCULATION_URI
    ? legacyCalculationUri
    : fpttCalculationUri
}

const calculateFpttPayments = (parcels, logger) =>
  calculatePaymentsBasedOnParcelsWithActions(parcels, logger, {
    calculationUri: getFpttCalculationUri()
  })

export { calculateFpttPayments }
