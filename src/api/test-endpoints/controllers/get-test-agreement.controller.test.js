import Boom from '@hapi/boom'
import { getTestAgreementController } from './get-test-agreement.controller.js'
import { getAgreementDataById } from '#~/api/agreement/helpers/get-agreement-data.js'

vi.mock('#~/api/agreement/helpers/get-agreement-data.js', () => ({
  getAgreementDataById: vi.fn()
}))

describe('getTestAgreementController', () => {
  const h = {
    response: vi.fn((payload) => ({
      code: vi.fn((status) => ({ payload, statusCode: status }))
    }))
  }

  const logger = { error: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns 200 with found agreements for single id', async () => {
    getAgreementDataById.mockResolvedValueOnce({ id: 'A1' })

    const request = { query: { id: 'A1' }, logger }
    const res = await getTestAgreementController.handler(request, h)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual([{ id: 'A1' }])
  })

  test('supports comma-delimited ids and ignores missing ones', async () => {
    getAgreementDataById
      .mockResolvedValueOnce({ id: 'A1' })
      .mockRejectedValueOnce(Boom.notFound())
      .mockResolvedValueOnce({ id: 'A3' })

    const request = { query: { id: 'A1, ,A2, A3' }, logger }
    const res = await getTestAgreementController.handler(request, h)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual([{ id: 'A1' }, { id: 'A3' }])
  })

  test('returns Boom 400 when id query param is missing', async () => {
    const request = { query: {}, logger }
    const err = await getTestAgreementController.handler(request, h)
    expect(Boom.isBoom(err)).toBe(true)
    expect(err.output.statusCode).toBe(400)
  })

  test('returns Boom 404 when no agreements found', async () => {
    getAgreementDataById.mockRejectedValue(Boom.notFound('not found'))
    const request = { query: { id: 'A1' }, logger }
    const err = await getTestAgreementController.handler(request, h)
    expect(Boom.isBoom(err)).toBe(true)
    expect(err.output.statusCode).toBe(404)
  })

  test('handles unexpected error by returning Boom not found (masked)', async () => {
    getAgreementDataById.mockRejectedValue(new Error('db down'))
    const request = { query: { id: 'A1' }, logger }
    const err = await getTestAgreementController.handler(request, h)
    expect(Boom.isBoom(err)).toBe(true)
    expect(err.output.statusCode).toBe(404)
  })
})
