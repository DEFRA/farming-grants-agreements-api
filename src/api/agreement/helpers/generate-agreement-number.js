import crypto from 'node:crypto'
import agreementsModel from '#~/api/common/models/agreements.js'

export const generateAgreementNumber = async (prefix) => {
  if (typeof prefix !== 'string' || !prefix.trim()) {
    throw new Error('Agreement number prefix is required')
  }
  const normalizedPrefix = prefix.trim().toUpperCase()

  const minRandomNumber = 100000000
  const maxRandomNumber = 999999999
  let agreementNumber
  let agreementNumberExists
  do {
    const randomNum = crypto.randomInt(minRandomNumber, maxRandomNumber)
    agreementNumber = `${normalizedPrefix}${randomNum}`
    agreementNumberExists = await agreementsModel.exists({ agreementNumber })
  } while (agreementNumberExists)
  return agreementNumber
}
