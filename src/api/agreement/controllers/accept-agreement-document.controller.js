import { acceptAgreementDocument } from '../services/agreement.service.js'

export const acceptAgreementDocumentController = async (request, h) => {
  try {
    const { id } = request.params
    const result = await acceptAgreementDocument(id)
    
    if (!result.success) {
      return h.response({ success: false }).code(400)
    }

    return h.response({ success: true })
  } catch (error) {
    console.error('Error accepting agreement document:', error)
    return h.response({ success: false }).code(500)
  }
} 