import mockAgreementData from './mock-agreement-data.js'

export default {
  updateOne: jest.fn(),
  findOne: jest.fn().mockResolvedValue(mockAgreementData)
}
