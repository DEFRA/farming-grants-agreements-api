import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Boom from '@hapi/boom'
import { customGrantsUiJwtScheme } from './custom-grants-ui-jwt-scheme.js'

// Mocks for external dependencies used by the scheme
const mockValidateJwtAuthentication = vi.fn()
const mockGetAgreementDataById = vi.fn()
const mockGetAgreementDataBySbi = vi.fn()

vi.mock('~/src/api/common/helpers/jwt-auth.js', () => ({
  validateJwtAuthentication: (...args) => mockValidateJwtAuthentication(...args)
}))

vi.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  getAgreementDataById: (...args) => mockGetAgreementDataById(...args),
  getAgreementDataBySbi: (...args) => mockGetAgreementDataBySbi(...args)
}))

describe('custom-grants-ui-jwt-scheme', () => {
  const scheme = customGrantsUiJwtScheme()

  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }

  let h

  beforeEach(() => {
    h = {
      authenticated: vi.fn((payload) => ({ type: 'authenticated', ...payload }))
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('authenticates with agreementId using getAgreementDataById and passes credentials', async () => {
    const agreementId = 'abc-123'
    const headerToken = 'encrypted-token'
    const agreementData = { id: agreementId, value: 1 }

    mockGetAgreementDataById.mockResolvedValueOnce(agreementData)
    mockValidateJwtAuthentication.mockReturnValueOnce({
      valid: true,
      source: 'defra'
    })

    const request = {
      params: { agreementId },
      headers: { 'x-encrypted-auth': headerToken },
      logger
    }

    const res = await scheme.authenticate(request, h)

    expect(mockGetAgreementDataById).toHaveBeenCalledWith(agreementId)
    expect(mockValidateJwtAuthentication).toHaveBeenCalledWith(
      headerToken,
      agreementData,
      logger
    )
    expect(mockGetAgreementDataBySbi).not.toHaveBeenCalled()

    expect(h.authenticated).toHaveBeenCalledTimes(1)
    expect(res).toMatchObject({
      type: 'authenticated',
      credentials: {
        agreementData,
        source: 'defra'
      }
    })
  })

  it('falls back to getAgreementDataBySbi when no agreementId and source is defra with sbi', async () => {
    const headerToken = 'encrypted-token-2'
    const sbi = '123456789'
    const fetchedAgreement = { id: 'from-sbi', sbi }

    mockValidateJwtAuthentication.mockReturnValueOnce({
      valid: true,
      source: 'defra',
      sbi
    })
    mockGetAgreementDataBySbi.mockResolvedValueOnce(fetchedAgreement)

    const request = {
      params: {},
      headers: { 'x-encrypted-auth': headerToken },
      logger
    }

    const res = await scheme.authenticate(request, h)

    expect(mockGetAgreementDataById).not.toHaveBeenCalled()
    expect(mockValidateJwtAuthentication).toHaveBeenCalledWith(
      headerToken,
      null,
      logger
    )
    expect(mockGetAgreementDataBySbi).toHaveBeenCalledWith(sbi)

    expect(h.authenticated).toHaveBeenCalledTimes(1)
    expect(res).toMatchObject({
      type: 'authenticated',
      credentials: {
        agreementData: fetchedAgreement,
        source: 'defra'
      }
    })
  })

  it('throws Boom.unauthorized when token is invalid', async () => {
    mockValidateJwtAuthentication.mockReturnValueOnce({ valid: false })

    const request = {
      params: {},
      headers: { 'x-encrypted-auth': 'bad-token' },
      logger
    }

    const authPromise = scheme.authenticate(request, h)

    await expect(authPromise).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 401 }
    })

    let err
    try {
      await authPromise
    } catch (caught) {
      err = caught
    }

    expect(Boom.isBoom(err)).toBe(true)
    expect(err.output.statusCode).toBe(401)
    expect(err.message).toBe(
      'Not authorized to view/accept offer agreement document'
    )

    expect(h.authenticated).not.toHaveBeenCalled()
    expect(mockGetAgreementDataById).not.toHaveBeenCalled()
    expect(mockGetAgreementDataBySbi).not.toHaveBeenCalled()
  })

  it('does not fetch by SBI when source is not defra or sbi missing; authenticates with null agreementData', async () => {
    mockValidateJwtAuthentication.mockReturnValueOnce({
      valid: true,
      source: 'somewhere-else'
    })

    const request = {
      params: {},
      headers: { 'x-encrypted-auth': 'tok' },
      logger
    }

    const res = await scheme.authenticate(request, h)

    expect(mockGetAgreementDataById).not.toHaveBeenCalled()
    expect(mockGetAgreementDataBySbi).not.toHaveBeenCalled()
    expect(res).toMatchObject({
      type: 'authenticated',
      credentials: {
        agreementData: null,
        source: 'somewhere-else'
      }
    })
  })
})
