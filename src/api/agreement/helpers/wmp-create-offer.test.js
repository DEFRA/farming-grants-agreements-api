import { vi, describe, it, beforeEach, expect } from 'vitest'

import wmpAgreementFixture from '#~/api/common/helpers/sample-data/wmp-agreement.js'
import agreementsModel from '#~/api/common/models/agreements.js'
import { publishEvent } from '#~/api/common/helpers/sns-publisher.js'
import { doesAgreementExist } from '#~/api/agreement/helpers/get-agreement-data.js'
import * as landGrantsAdapter from '#~/api/adapter/land-grants-adapter.js'
import { wmpCreateOffer } from './wmp-create-offer.js'

vi.mock('#~/api/common/models/agreements.js', () => ({
  __esModule: true,
  default: {
    createAgreementWithVersions: vi.fn(),
    exists: vi.fn().mockResolvedValue(false)
  }
}))
vi.mock('#~/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(true)
}))
vi.mock('#~/api/agreement/helpers/get-agreement-data.js', () => ({
  doesAgreementExist: vi.fn().mockResolvedValue(false)
}))
vi.mock('#~/api/adapter/land-grants-adapter.js', () => ({
  calculatePaymentsBasedOnParcelsWithActions: vi.fn()
}))

const logger = { info: vi.fn(), error: vi.fn() }

describe('wmpCreateOffer (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    agreementsModel.createAgreementWithVersions.mockImplementation(
      ({ agreement }) => ({
        ...agreement,
        updatedAt: new Date('2026-04-20T10:00:00.000Z'),
        versions: []
      })
    )
  })

  it('persists a WMP offer end-to-end without calling Land Grants', async () => {
    const result = await wmpCreateOffer(
      'sqs-msg-1',
      wmpAgreementFixture,
      logger
    )

    // Persistence: ignorePayments must be false so the WMP payment subdoc survives
    expect(agreementsModel.createAgreementWithVersions).toHaveBeenCalledTimes(1)
    const [{ agreement, versions, ignorePayments }] =
      agreementsModel.createAgreementWithVersions.mock.calls[0]
    expect(ignorePayments).toBe(false)
    expect(agreement.sbi).toBe(wmpAgreementFixture.metadata.sbi)
    expect(agreement.clientRef).toBe(wmpAgreementFixture.metadata.clientRef)
    expect(agreement.agreementNumber).toMatch(/^FPTT\d{9}$/)

    // Version: status offered, scheme WMP, payment derived from payload
    expect(versions).toHaveLength(1)
    const [version] = versions
    expect(version.status).toBe('offered')
    expect(version.scheme).toBe('WMP')
    expect(version.notificationMessageId).toBe('sqs-msg-1')
    expect(version.payment.agreementTotalPence).toBe(
      wmpAgreementFixture.answers.totalAgreementPaymentPence
    )
    expect(version.payment.payments[0].paymentDate).toBeNull()
    expect(version.payment.frequency).toBe('OneOff')

    // Announce: SNS event with status=offered and scheme=WMP
    expect(publishEvent).toHaveBeenCalledTimes(1)
    const [event] = publishEvent.mock.calls[0]
    expect(event.data.status).toBe('offered')
    expect(event.data.scheme).toBe('WMP')
    expect(event.data.clientRef).toBe(wmpAgreementFixture.metadata.clientRef)

    // Land Grants must NOT be called for WMP (AC4)
    expect(
      landGrantsAdapter.calculatePaymentsBasedOnParcelsWithActions
    ).not.toHaveBeenCalled()

    expect(result.agreementNumber).toMatch(/^FPTT\d{9}$/)
  })

  it('rejects duplicate notification message id', async () => {
    doesAgreementExist.mockResolvedValueOnce(true)
    await expect(
      wmpCreateOffer('dup-msg', wmpAgreementFixture, logger)
    ).rejects.toThrow(/already been created/)
    expect(agreementsModel.createAgreementWithVersions).not.toHaveBeenCalled()
    expect(publishEvent).not.toHaveBeenCalled()
  })

  it('rejects an invalid payload via the WMP Joi schema', async () => {
    const broken = {
      ...wmpAgreementFixture,
      answers: {
        ...wmpAgreementFixture.answers,
        totalAgreementPaymentPence: 999 // does not match Σ agreementTotalPence
      }
    }
    await expect(wmpCreateOffer('msg-bad', broken, logger)).rejects.toThrow(
      /Invalid WMP create-agreement payload/
    )
    expect(agreementsModel.createAgreementWithVersions).not.toHaveBeenCalled()
    expect(
      landGrantsAdapter.calculatePaymentsBasedOnParcelsWithActions
    ).not.toHaveBeenCalled()
  })
})
