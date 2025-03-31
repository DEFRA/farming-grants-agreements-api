import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'

jest.mock('~/src/api/agreement/helpers/get-agreement-data.js')
jest.mock('~/src/api/agreement/helpers/nunjucks-renderer.js')

describe('getHTMLAgreementDocument', () => {
  const mockRenderedHtml = `<!DOCTYPE html><html><body>Test HTML with SFI123456789</body></html>`

  beforeEach(() => {
    jest.clearAllMocks()
    // Set up the default mock implementations
    renderTemplate.mockReturnValue(mockRenderedHtml)
  })

  test('should return rendered HTML', async () => {
    const renderedHTML = await getHTMLAgreementDocument('SFI123456789')

    expect(getAgreementData).toHaveBeenCalledWith('SFI123456789')
    expect(renderTemplate).toHaveBeenCalled()
    expect(renderedHTML).toMatch(/Test HTML with SFI123456789/)
  })

  test('should fail gracefully when agreement data retrieval fails', async () => {
    const errorMessage = 'Failed to retrieve agreement data'
    getAgreementData.mockRejectedValueOnce(new Error(errorMessage))

    await expect(getHTMLAgreementDocument('SFI123456789')).rejects.toThrow(
      errorMessage
    )
  })
})
