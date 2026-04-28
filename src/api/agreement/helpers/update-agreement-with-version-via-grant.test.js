import { vi } from 'vitest'
import { updateAgreementWithVersionViaGrant } from './update-agreement-with-version-via-grant.js'
import versionsModel from '#~/api/common/models/versions.js'
import grantModel from '#~/api/common/models/grant.js'
import agreementsModel from '#~/api/common/models/agreements.js'

vi.mock('#~/api/common/models/versions.js')
vi.mock('#~/api/common/models/grant.js')
vi.mock('#~/api/common/models/agreements.js')

describe('updateAgreementWithVersionViaGrant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should find version via grant', async () => {
    const mockAgreement = { agreementNumber: 'FPTT123' }
    const mockGrant = { _id: 'grant123' }
    const mockVersion = { _id: 'version456' }
    const mockUpdatedVersion = {
      _id: 'version456'
    }

    agreementsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockAgreement)
    })

    grantModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockGrant)
    })

    versionsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockVersion)
    })

    const findOneAndUpdateSpy = vi
      .spyOn(versionsModel, 'findOneAndUpdate')
      .mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockUpdatedVersion),
        catch: vi.fn().mockResolvedValue(mockUpdatedVersion)
      })

    const result = await updateAgreementWithVersionViaGrant(
      { agreementNumber: 'FPTT123' },
      { status: 'accepted' }
    )

    expect(result).toEqual(mockUpdatedVersion)
    expect(agreementsModel.findOne).toHaveBeenCalledWith({
      agreementNumber: 'FPTT123'
    })
    expect(grantModel.findOne).toHaveBeenCalledWith({
      agreementNumber: 'FPTT123'
    })
    expect(versionsModel.findOne).toHaveBeenCalledWith({ grant: 'grant123' })
    expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
      { _id: 'version456' },
      { status: 'accepted' },
      expect.any(Object)
    )
  })

  it('should throw 404 if agreement not found', async () => {
    agreementsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null)
    })

    await expect(
      updateAgreementWithVersionViaGrant(
        { agreementNumber: 'FPTT123' },
        { status: 'accepted' }
      )
    ).rejects.toThrow('Agreement not found using filter')
  })

  it('should throw 404 if version not found', async () => {
    agreementsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ agreementNumber: 'FPTT123' })
    })

    grantModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: 'grant123' })
    })

    versionsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null)
    })

    await expect(
      updateAgreementWithVersionViaGrant(
        { agreementNumber: 'FPTT123' },
        { status: 'accepted' }
      )
    ).rejects.toThrow(
      'Latest version not found for grant associated with agreement'
    )
  })

  it('should throw Boom.internal if agreementsModel.findOne fails', async () => {
    agreementsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockRejectedValue(new Error('DB Error'))
    })

    await expect(
      updateAgreementWithVersionViaGrant(
        { agreementNumber: 'FPTT123' },
        { status: 'accepted' }
      )
    ).rejects.toThrow('DB Error')
  })

  it('should throw Boom.internal if grantModel.findOne fails', async () => {
    agreementsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ agreementNumber: 'FPTT123' })
    })

    grantModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockRejectedValue(new Error('Grant DB Error'))
    })

    await expect(
      updateAgreementWithVersionViaGrant(
        { agreementNumber: 'FPTT123' },
        { status: 'accepted' }
      )
    ).rejects.toThrow('Grant DB Error')
  })

  it('should throw Boom.internal if versionsModel.findOne fails', async () => {
    agreementsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ agreementNumber: 'FPTT123' })
    })

    grantModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: 'grant123' })
    })

    versionsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockRejectedValue(new Error('Version DB Error'))
    })

    await expect(
      updateAgreementWithVersionViaGrant(
        { agreementNumber: 'FPTT123' },
        { status: 'accepted' }
      )
    ).rejects.toThrow('Version DB Error')
  })

  it('should throw Boom.internal if versionsModel.findOneAndUpdate fails', async () => {
    agreementsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ agreementNumber: 'FPTT123' })
    })

    grantModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: 'grant123' })
    })

    versionsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: 'version123' })
    })

    versionsModel.findOneAndUpdate.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      catch: vi.fn().mockRejectedValue(new Error('Update Error'))
    })

    await expect(
      updateAgreementWithVersionViaGrant(
        { agreementNumber: 'FPTT123' },
        { status: 'accepted' }
      )
    ).rejects.toThrow('Update Error')
  })

  it('should throw 404 if findOneAndUpdate returns null', async () => {
    agreementsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ agreementNumber: 'FPTT123' })
    })

    grantModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: 'grant123' })
    })

    versionsModel.findOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: 'version123' })
    })

    versionsModel.findOneAndUpdate.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      catch: vi.fn().mockResolvedValue(null)
    })

    await expect(
      updateAgreementWithVersionViaGrant(
        { agreementNumber: 'FPTT123' },
        { status: 'accepted' }
      )
    ).rejects.toThrow('Failed to update agreement. Agreement not found')
  })
})
