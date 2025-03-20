import { Agreement } from '../models/agreement.model.js'

export const getAgreementDocument = async (id) => {
  return Agreement.findOne({ agreementId: id })
}

export const acceptAgreementDocument = async (id) => {
  try {
    const agreement = await Agreement.findOne({ agreementId: id })
    
    if (!agreement) {
      return { success: false, error: 'Agreement not found' }
    }

    if (agreement.signatureDate) {
      return { success: false, error: 'Agreement already accepted' }
    }

    agreement.signatureDate = new Date()
    await agreement.save()

    return { success: true }
  } catch (error) {
    console.error('Error accepting agreement:', error)
    return { success: false, error: error.message }
  }
} 