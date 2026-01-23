import { vi } from 'vitest'

const getAgreementData = vi.fn(() => ({
  agreementNumber: 'FPTT123456789',
  agreementName: 'Sample Agreement',
  signatureDate: '1/11/2024'
}))

export { getAgreementData }
