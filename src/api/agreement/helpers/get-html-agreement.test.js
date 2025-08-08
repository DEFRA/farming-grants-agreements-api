import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import * as getAgreementDataModule from '~/src/api/agreement/helpers/get-agreement-data.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'

jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  getAgreementDataById: jest.fn()
}))

describe('getHTMLAgreementDocument', () => {
  const mockRenderedHtml = `<!DOCTYPE html><html><body>Test HTML with SFI123456789</body></html>`

  beforeEach(() => {
    jest.clearAllMocks()

    // Set up the default mock implementations
    renderTemplate.mockReturnValue(mockRenderedHtml)
  })

  test('should return rendered HTML', async () => {
    const mockAgreement = {
      status: 'offered',
      username: 'Test User',
      parcels: [],
      actions: [],
      payments: {
        activities: [],
        yearlyBreakdown: {
          details: [],
          annualTotals: {},
          totalAgreementPayment: 0
        }
      },
      agreementNumber: 'SFI123456789'
    }
    getAgreementDataModule.getAgreementDataById.mockResolvedValueOnce(
      mockAgreement
    )

    const renderedHTML = await getHTMLAgreementDocument('SFI123456789')

    expect(getAgreementDataModule.getAgreementDataById).toHaveBeenCalledWith(
      'SFI123456789'
    )
    expect(renderTemplate).toHaveBeenCalled()
    expect(renderedHTML).toMatch(/Test HTML with SFI123456789/)
  })

  test('should fail gracefully when agreement data retrieval fails', async () => {
    const errorMessage = 'Failed to retrieve agreement data'
    getAgreementDataModule.getAgreementDataById.mockRejectedValueOnce(
      new Error(errorMessage)
    )

    await expect(getHTMLAgreementDocument('SFI123456789')).rejects.toThrow(
      errorMessage
    )
  })
})
