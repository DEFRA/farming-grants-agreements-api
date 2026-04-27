import { describe, it, expect } from 'vitest'
import { validateWmpCreateAgreement } from './wmp-create-agreement.schema.js'
import wmpFixture from '#~/api/common/helpers/sample-data/wmp-agreement.js'
// deep clone (avoid mutating shared fixture across tests)
const clone = (o) => JSON.parse(JSON.stringify(o))
describe('wmpCreateAgreementSchema', () => {
  it('accepts the canonical Jira fixture', () => {
    const { error } = validateWmpCreateAgreement(wmpFixture)
    expect(error).toBeUndefined()
  })
  describe('metadata', () => {
    it.each([
      ['sbi', '20000000', 'must be a 9-digit numeric string'],
      ['crn', 'abcdefghij', 'must be a 10-digit numeric string'],
      ['frn', '123', 'must be a 10-digit numeric string']
    ])('rejects malformed metadata.%s', (field, badValue, msg) => {
      const p = clone(wmpFixture)
      p.metadata[field] = badValue
      const { error } = validateWmpCreateAgreement(p)
      expect(error?.details.some((d) => d.message.includes(msg))).toBe(true)
    })
    it('rejects non-ISO submittedAt', () => {
      const p = clone(wmpFixture)
      p.metadata.submittedAt = 'not-a-date'
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })
    it.each(['sbi', 'crn', 'frn', 'submittedAt', 'clientRef'])(
      'rejects missing metadata.%s',
      (field) => {
        const p = clone(wmpFixture)
        delete p.metadata[field]
        const { error } = validateWmpCreateAgreement(p)
        expect(error).toBeDefined()
      }
    )
  })
  describe('applicant', () => {
    it('rejects missing business.name', () => {
      const p = clone(wmpFixture)
      delete p.answers.applicant.business.name
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })
    it('rejects invalid postcode', () => {
      const p = clone(wmpFixture)
      p.answers.applicant.business.address.postalCode = 'NOT-A-POSTCODE'
      const { error } = validateWmpCreateAgreement(p)
      expect(
        error?.details.some((d) => d.message.includes('valid UK postcode'))
      ).toBe(true)
    })
    it('accepts email as object {address}', () => {
      const { error } = validateWmpCreateAgreement(wmpFixture)
      expect(error).toBeUndefined()
    })
    it('accepts email as plain string', () => {
      const p = clone(wmpFixture)
      p.answers.applicant.business.email = 'plain@example.test'
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeUndefined()
    })
    it('rejects missing customer.name.first', () => {
      const p = clone(wmpFixture)
      delete p.answers.applicant.customer.name.first
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })
  })
  describe('cross-field rules', () => {
    it('rejects when totalAgreementPaymentPence != Σ payments.agreement[]', () => {
      const p = clone(wmpFixture)
      p.answers.totalAgreementPaymentPence = 999999
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
      expect(error.message).toMatch(/totalAgreementPaymentPence/)
    })
    it('rejects when totalHectaresAppliedFor differs from Σ landParcels.areaHa beyond tolerance', () => {
      const p = clone(wmpFixture)
      p.answers.totalHectaresAppliedFor = 999.99
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
      expect(error.message).toMatch(/totalHectaresAppliedFor/)
    })
    it('accepts hectares mismatch within ±0.01 tolerance', () => {
      const p = clone(wmpFixture)
      p.answers.totalHectaresAppliedFor = 195.25 // vs 195.246 actual
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeUndefined()
    })
    it('rejects guidanceRead=false', () => {
      const p = clone(wmpFixture)
      p.answers.guidanceRead = false
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
      expect(error.message).toMatch(/guidanceRead/)
    })
    it('rejects applicationConfirmation=false', () => {
      const p = clone(wmpFixture)
      p.answers.applicationConfirmation = false
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
      expect(error.message).toMatch(/applicationConfirmation/)
    })
    it('rejects empty existingWmps when appLandHasExistingWmp=true', () => {
      const p = clone(wmpFixture)
      p.answers.appLandHasExistingWmp = true
      p.answers.existingWmps = ''
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
      expect(error.message).toMatch(/existingWmps/)
    })
    it('allows empty existingWmps when appLandHasExistingWmp=false', () => {
      const p = clone(wmpFixture)
      p.answers.appLandHasExistingWmp = false
      p.answers.existingWmps = ''
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeUndefined()
    })
  })
  describe('booleans are strict', () => {
    it('rejects string "true" for businessDetailsUpToDate', () => {
      const p = clone(wmpFixture)
      p.answers.businessDetailsUpToDate = 'true'
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })
  })
  describe('payments.agreement[]', () => {
    it('rejects empty payments.agreement', () => {
      const p = clone(wmpFixture)
      p.answers.payments.agreement = []
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })
    it('rejects negative agreementTotalPence', () => {
      const p = clone(wmpFixture)
      p.answers.payments.agreement[0].agreementTotalPence = -1
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })
    it('rejects non-integer pence', () => {
      const p = clone(wmpFixture)
      p.answers.payments.agreement[0].agreementTotalPence = 100.5
      p.answers.totalAgreementPaymentPence = 100.5
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })
  })
  describe('landParcels', () => {
    it('rejects empty landParcels', () => {
      const p = clone(wmpFixture)
      p.answers.landParcels = []
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })
    it('rejects non-positive areaHa', () => {
      const p = clone(wmpFixture)
      p.answers.landParcels[0].areaHa = 0
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })
  })
})
