import { vi } from 'vitest'
import mongoose from 'mongoose'
import { createAgreementWithGrantAndVersions } from './create-agreement-with-grant-and-versions.js'
import agreementsModel from '#~/api/common/models/agreements.js'
import versionsModel from '#~/api/common/models/versions.js'
import grantModel from '#~/api/common/models/grant.js'

vi.unmock('mongoose')

describe('createAgreementWithGrantAndVersions', () => {
  const AGREEMENT_BASE = {
    agreementNumber: 'FPTT123456789',
    clientRef: 'TEST-CLIENT-REF',
    sbi: '106284736',
    frn: '1234567890'
  }

  const VERSION_PAYLOADS = [
    {
      notificationMessageId: 'msg-1',
      correlationId: 'corr-1',
      clientRef: 'TEST-CLIENT-REF',
      code: 'SFI24',
      scheme: 'SFI',
      claimId: 'CLAIM-1',
      identifiers: { sbi: '106284736', frn: '1234567890', crn: 'CRN1' },
      status: 'offered',
      actionApplications: [],
      applicant: {
        business: {
          name: 'B',
          address: { city: 'C', line1: 'L', postalCode: 'P' }
        },
        customer: { name: { first: 'F', last: 'L' } }
      },
      application: { parcel: [] }
    }
  ]

  beforeAll(async () => {
    // Use the memory server URI from global setup
    await mongoose.connect(process.env.MONGO_URI)
  })

  afterAll(async () => {
    await mongoose.disconnect()
  })

  beforeEach(async () => {
    await agreementsModel.deleteMany({})
    await versionsModel.deleteMany({})
    await grantModel.deleteMany({})
  })

  it('should create a new agreement, grant and versions when they do not exist', async () => {
    const result = await createAgreementWithGrantAndVersions({
      agreement: AGREEMENT_BASE,
      versions: VERSION_PAYLOADS
    })

    expect(result.agreementNumber).toBe(AGREEMENT_BASE.agreementNumber)
    expect(result.grants).toHaveLength(1)

    // Check database
    const agreement = await agreementsModel.findOne({
      agreementNumber: AGREEMENT_BASE.agreementNumber
    })
    const grant = await grantModel.findOne({
      agreementNumber: AGREEMENT_BASE.agreementNumber
    })
    const version = await versionsModel.findOne({
      notificationMessageId: 'msg-1'
    })

    expect(agreement).toBeDefined()
    expect(grant).toBeDefined()
    expect(version).toBeDefined()

    expect(version.grant.toString()).toBe(grant._id.toString())

    expect(agreement.grants).toContainEqual(grant._id)
    expect(grant.versions).toContainEqual(version._id)
  })

  it('should reuse existing agreement and grant when they exist', async () => {
    // 1. Initial creation
    await createAgreementWithGrantAndVersions({
      agreement: AGREEMENT_BASE,
      versions: VERSION_PAYLOADS
    })

    const initialAgreement = await agreementsModel.findOne({
      sbi: AGREEMENT_BASE.sbi
    })
    const initialGrant = await grantModel.findOne({
      agreementNumber: AGREEMENT_BASE.agreementNumber
    })

    // 2. Add another version
    const NEW_VERSION_PAYLOADS = [
      {
        ...VERSION_PAYLOADS[0],
        notificationMessageId: 'msg-2',
        correlationId: 'corr-2'
      }
    ]

    const result = await createAgreementWithGrantAndVersions({
      agreement: AGREEMENT_BASE,
      versions: NEW_VERSION_PAYLOADS
    })

    expect(result.grants).toHaveLength(1) // Should still be 1 grant

    const finalAgreement = await agreementsModel.findOne({
      sbi: AGREEMENT_BASE.sbi
    })
    const finalGrant = await grantModel.findOne({
      agreementNumber: AGREEMENT_BASE.agreementNumber
    })

    expect(finalAgreement._id.toString()).toBe(initialAgreement._id.toString())
    expect(finalGrant._id.toString()).toBe(initialGrant._id.toString())
    expect(finalGrant.versions).toHaveLength(2)

    const v1 = await versionsModel.findOne({ notificationMessageId: 'msg-1' })
    const v2 = await versionsModel.findOne({ notificationMessageId: 'msg-2' })

    expect(v1.grant.toString()).toBe(finalGrant._id.toString())
    expect(v2.grant.toString()).toBe(finalGrant._id.toString())
  })

  it('should throw error if agreementNumber is missing', async () => {
    await expect(
      createAgreementWithGrantAndVersions({
        agreement: { sbi: '123' },
        versions: VERSION_PAYLOADS
      })
    ).rejects.toThrow('agreement.agreementNumber is required')
  })

  it('should throw error if versions is not a non-empty array', async () => {
    await expect(
      createAgreementWithGrantAndVersions({
        agreement: AGREEMENT_BASE,
        versions: []
      })
    ).rejects.toThrow('versions must be a non-empty array')

    await expect(
      createAgreementWithGrantAndVersions({
        agreement: AGREEMENT_BASE,
        versions: 'not-an-array'
      })
    ).rejects.toThrow('versions must be a non-empty array')
  })

  it('should catch and rethrow errors in the main function', async () => {
    // Mock findOne to throw by returning a chain that throws on sort or lean
    vi.spyOn(agreementsModel, 'findOne').mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockRejectedValue(new Error('Main catch error'))
    })

    await expect(
      createAgreementWithGrantAndVersions({
        agreement: AGREEMENT_BASE,
        versions: VERSION_PAYLOADS
      })
    ).rejects.toThrow('Main catch error')

    agreementsModel.findOne.mockRestore()
  })
})
