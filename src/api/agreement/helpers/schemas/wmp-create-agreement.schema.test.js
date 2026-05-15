import { describe, it, expect } from 'vitest'
import { validateWmpCreateAgreement } from './wmp-create-agreement.schema.js'
import wmpFixture from '#~/api/common/helpers/sample-data/wmp-agreement.js'

const clone = (o) => JSON.parse(JSON.stringify(o))

describe('wmpCreateAgreementSchema', () => {
  it('accepts the canonical WMP fixture', () => {
    const { error } = validateWmpCreateAgreement(wmpFixture)
    expect(error).toBeUndefined()
  })

  it('rejects missing code', () => {
    const p = clone(wmpFixture)
    delete p.code
    const { error } = validateWmpCreateAgreement(p)
    expect(error).toBeDefined()
    expect(error.message).toMatch(/"code" is required/)
  })

  describe('identifiers', () => {
    it.each([
      ['sbi', '20000000', 'must be a 9-digit numeric string'],
      ['crn', 'abcdefghij', 'must be a 10-digit numeric string'],
      ['frn', '123', 'must be a 10-digit numeric string']
    ])('rejects malformed identifiers.%s', (field, badValue, msg) => {
      const p = clone(wmpFixture)
      p.identifiers[field] = badValue
      const { error } = validateWmpCreateAgreement(p)
      expect(error?.details.some((d) => d.message.includes(msg))).toBe(true)
    })
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

  describe('payments', () => {
    it('accepts the fixture payment block', () => {
      const { error } = validateWmpCreateAgreement(wmpFixture)
      expect(error).toBeUndefined()
    })

    it('rejects a lean agreement payment item without payment totals', () => {
      const p = clone(wmpFixture)
      p.answers.payments = {
        agreement: [{ code: 'PA3', description: 'Woodland management plan' }]
      }
      delete p.answers.totalAgreementPaymentPence
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
      expect(error.message).toMatch(/agreementTotalPence/)
    })

    it('rejects payment item missing required code', () => {
      const p = clone(wmpFixture)
      delete p.answers.payments.agreement[0].code
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })

    it('rejects when totalAgreementPaymentPence does not match sum', () => {
      const p = clone(wmpFixture)
      p.answers.totalAgreementPaymentPence = 999
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
      expect(error.message).toMatch(/totalAgreementPaymentPence/)
    })

    it('rejects payments omitted entirely', () => {
      const p = clone(wmpFixture)
      delete p.answers.payments
      delete p.answers.totalAgreementPaymentPence
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
      expect(error.message).toMatch(/payments/)
    })
  })

  describe('landParcels', () => {
    it('accepts the fixture landParcels block', () => {
      const { error } = validateWmpCreateAgreement(wmpFixture)
      expect(error).toBeUndefined()
    })

    it('rejects landParcels omitted entirely', () => {
      const p = clone(wmpFixture)
      delete p.answers.landParcels
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
      expect(error.message).toMatch(/landParcels/)
    })

    it('rejects when totalHectaresForSelectedParcels mismatches landParcels sum', () => {
      const p = clone(wmpFixture)
      p.answers.totalHectaresForSelectedParcels = 1
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
      expect(error.message).toMatch(/totalHectaresForSelectedParcels/)
    })

    it('rejects landParcel missing parcelId', () => {
      const p = clone(wmpFixture)
      delete p.answers.landParcels[0].parcelId
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })
  })
})
