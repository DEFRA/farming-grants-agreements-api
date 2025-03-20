import { getAgreementDocument } from '../services/agreement.service.js'
import { renderAgreementDocument } from '../helpers/nunjucks-renderer.js'

export const getAgreementDocumentController = async (request, h) => {
  try {
    const { id } = request.params
    const agreement = await getAgreementDocument(id)
    
    if (!agreement) {
      return h.response().code(404)
    }

    const html = await renderAgreementDocument(agreement)
    return h.response(html)
      .header('Content-Type', 'text/html')
  } catch (error) {
    console.error('Error getting agreement document:', error)
    return h.response().code(500)
  }
} 