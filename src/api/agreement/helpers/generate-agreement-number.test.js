import { describe, it, expect, beforeEach, vi } from 'vitest'
import agreementsModel from '#~/api/common/models/agreements.js'
import { generateAgreementNumber } from './generate-agreement-number.js'

vi.mock('#~/api/common/models/agreements.js', () => ({
  default: {
    exists: vi.fn().mockResolvedValue(false)
  }
}))

describe('generateAgreementNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    agreementsModel.exists.mockResolvedValue(false)
  })

  it('generates a valid agreement number with the supplied prefix', async () => {
    const agreementNumber = await generateAgreementNumber('FPTT')
    expect(agreementNumber).toMatch(/^FPTT\d{9}$/)
  })

  it('supports WMP-prefixed agreement numbers', async () => {
    const agreementNumber = await generateAgreementNumber('WMP')
    expect(agreementNumber).toMatch(/^WMP\d{9}$/)
  })

  it('normalises the supplied prefix', async () => {
    const agreementNumber = await generateAgreementNumber(' wmp ')
    expect(agreementNumber).toMatch(/^WMP\d{9}$/)
  })

  it('generates unique agreement numbers', async () => {
    const numbers = new Set()
    for (let i = 0; i < 100; i++) {
      numbers.add(await generateAgreementNumber('FPTT'))
    }
    expect(numbers.size).toBe(100)
  })

  it('retries until a non-duplicate agreement number is found', async () => {
    agreementsModel.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    const agreementNumber = await generateAgreementNumber('FPTT')

    expect(agreementNumber).toMatch(/^FPTT\d{9}$/)
    expect(agreementsModel.exists).toHaveBeenCalledTimes(3)
  })

  it('rejects missing agreement number prefix', async () => {
    await expect(generateAgreementNumber()).rejects.toThrow(
      'Agreement number prefix is required'
    )
  })
})
