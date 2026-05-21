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
    it('allows non-numeric identifier values', () => {
      const p = clone(wmpFixture)
      p.identifiers.sbi = 'sbi-from-source'
      p.identifiers.frn = '106480734'
      p.identifiers.crn = 'crn-from-source'
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeUndefined()
    })

    it('rejects identifiers supplied only in metadata', () => {
      const p = clone(wmpFixture)
      p.identifiers = undefined
      p.metadata = {
        sbi: 'sbi-from-metadata',
        frn: 'frn-from-metadata',
        crn: 'crn-from-metadata'
      }
      const { error } = validateWmpCreateAgreement(p)
      expect(error?.message).toMatch(/"identifiers" is required/)
    })

    it('rejects missing identifiers', () => {
      const p = clone(wmpFixture)
      delete p.identifiers.frn
      const { error } = validateWmpCreateAgreement(p)
      expect(error?.message).toMatch(/"identifiers.frn" is required/)
    })

    it('rejects blank identifiers', () => {
      const p = clone(wmpFixture)
      p.identifiers.sbi = '   '
      const { error } = validateWmpCreateAgreement(p)
      expect(error?.message).toMatch(
        /"identifiers.sbi" is not allowed to be empty/
      )
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
    it('allows source-only applicant fields without validating their shape', () => {
      const p = clone(wmpFixture)
      p.answers.applicant.business.reference = { unexpected: true }
      p.answers.applicant.business.email = 'not-an-email'
      p.answers.applicant.business.phone = { unexpected: true }
      p.answers.applicant.business.address.uprn = { unexpected: true }
      p.answers.applicant.business.address.flatName = 123
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

  describe('source-only answers', () => {
    it('does not require answers that Agreements does not map or pass on', () => {
      const p = clone(wmpFixture)

      for (const field of [
        'businessDetailsUpToDate',
        'landRegisteredWithRpa',
        'landManagementControl',
        'publicBodyTenant',
        'landHasGrazingRights',
        'appLandHasExistingWmp',
        'existingWmps',
        'intendToApplyHigherTier',
        'centreGridReference',
        'fcTeamCode',
        'detailsConfirmedAt',
        'totalHectaresForSelectedParcels',
        'guidanceRead',
        'includedAllEligibleWoodland',
        'applicationConfirmation'
      ]) {
        delete p.answers[field]
      }

      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeUndefined()
    })

    it('does not validate the shape of source-only answers', () => {
      const p = clone(wmpFixture)
      p.answers.businessDetailsUpToDate = 'true'
      p.answers.guidanceRead = false
      p.answers.applicationConfirmation = false
      p.answers.appLandHasExistingWmp = true
      p.answers.existingWmps = ''
      p.answers.detailsConfirmedAt = 'not-a-date'
      p.answers.totalHectaresForSelectedParcels = { unexpected: true }
      p.answers.centreGridReference = null

      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeUndefined()
    })
  })

  describe('woodlandName', () => {
    it('rejects missing woodlandName', () => {
      const p = clone(wmpFixture)
      delete p.answers.woodlandName
      const { error } = validateWmpCreateAgreement(p)
      expect(error?.message).toMatch(/"answers.woodlandName" is required/)
    })

    it('rejects woodlandName with only whitespace', () => {
      const p = clone(wmpFixture)
      p.answers.woodlandName = '   '
      const { error } = validateWmpCreateAgreement(p)
      expect(error?.message).toMatch(
        /"answers.woodlandName" is not allowed to be empty/
      )
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

    it('does not validate totalHectaresForSelectedParcels against landParcels', () => {
      const p = clone(wmpFixture)
      p.answers.totalHectaresForSelectedParcels = 1
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeUndefined()
    })

    it('rejects landParcel missing parcelId', () => {
      const p = clone(wmpFixture)
      delete p.answers.landParcels[0].parcelId
      const { error } = validateWmpCreateAgreement(p)
      expect(error).toBeDefined()
    })
  })
})
