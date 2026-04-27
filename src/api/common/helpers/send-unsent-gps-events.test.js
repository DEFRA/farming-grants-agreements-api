import { vi, describe, it, expect, beforeEach } from 'vitest'
import { sendUnsetGPSEventsPlugin } from './send-unsent-gps-events.js'
import { config } from '#~/config/index.js'
import { sendGrantPaymentEvent } from '#~/api/common/helpers/send-grant-payment-event.js'
import versionsModel from '#~/api/common/models/versions.js'
import agreementsModel from '#~/api/common/models/agreements.js'

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'log') {
        return {
          enabled: true,
          redact: [],
          level: 'info',
          format: 'pino-pretty'
        }
      }
      if (key === 'serviceName') return 'test-service'
      if (key === 'serviceVersion') return '1.0.0'
      return null
    })
  }
}))
vi.mock('#~/api/common/helpers/send-grant-payment-event.js')
vi.mock('#~/api/common/models/versions.js')
vi.mock('#~/api/common/models/agreements.js')

describe('sendUnsetGPSEventsPlugin', () => {
  let server

  beforeEach(() => {
    vi.clearAllMocks()
    server = {
      logger: {
        info: vi.fn(),
        error: vi.fn()
      },
      events: {
        on: vi.fn()
      }
    }
  })

  it('should not do anything if feature flag is disabled', () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') return false
      return null
    })
    sendUnsetGPSEventsPlugin.register(server)
    expect(server.events.on).not.toHaveBeenCalled()
    expect(server.logger.info).not.toHaveBeenCalled()
    expect(server.logger.error).not.toHaveBeenCalled()
  })

  it('should register start event listener if feature flag is enabled', () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') return true
      return null
    })
    sendUnsetGPSEventsPlugin.register(server)
    expect(server.events.on).toHaveBeenCalledWith('start', expect.any(Function))
  })

  it('should process missed payments on start', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') return true
      if (key === 'aws.sns.topic.createPayment.arn') return 'arn:test'
      if (key === 'aws.sns.topic.createPayment.type') return 'test.type'
      return null
    })

    const mockAgreements = [{ _id: { toString: () => 'agreement1' } }]

    vi.mocked(agreementsModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockAgreements)
      })
    })

    const mockMissedPayments = [
      {
        _id: 'v1',
        agreement: { agreementNumber: 'AG1' },
        status: 'accepted'
      }
    ]

    const populateMock = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockMissedPayments)
    })

    vi.mocked(versionsModel.find).mockReturnValue({
      populate: populateMock
    })

    vi.mocked(sendGrantPaymentEvent).mockResolvedValue({
      claimId: 'C1',
      some: 'data'
    })

    sendUnsetGPSEventsPlugin.register(server)
    const startHandler = server.events.on.mock.calls.find(
      (call) => call[0] === 'start'
    )[1]

    await startHandler()

    expect(server.logger.info).toHaveBeenCalledWith(
      'Found 1 agreements with missed GPS payment events'
    )

    expect(versionsModel.find).toHaveBeenCalledWith({
      status: 'accepted',
      agreement: { $in: ['agreement1'] },
      'payment.agreementStartDate': { $lt: '2026-05-01' }
    })

    expect(populateMock).toHaveBeenCalledWith('agreement')

    expect(sendGrantPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementNumber: 'AG1',
        agreement: { agreementNumber: 'AG1' }
      }),
      expect.anything()
    )
  })

  it('should handle errors gracefully during processing', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') return true
      return null
    })

    const mockAgreements = [{ _id: { toString: () => 'agreement1' } }]

    vi.mocked(agreementsModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockAgreements)
      })
    })

    const mockMissedPayments = [
      {
        _id: 'v1',
        agreement: { agreementNumber: 'AG1' },
        status: 'accepted'
      }
    ]

    vi.mocked(versionsModel.find).mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockMissedPayments)
      })
    })

    vi.mocked(sendGrantPaymentEvent).mockRejectedValue(new Error('Test error'))

    sendUnsetGPSEventsPlugin.register(server)
    const startHandler = server.events.on.mock.calls.find(
      (call) => call[0] === 'start'
    )[1]

    await startHandler()

    expect(server.logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to process missed payment for agreement AG1: Test error'
      )
    )
    expect(versionsModel.updateOne).not.toHaveBeenCalled()
  })

  it('should skip processing when agreement number is missing', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') return true
      return null
    })

    const mockAgreements = [{ _id: { toString: () => 'agreement1' } }]

    vi.mocked(agreementsModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockAgreements)
      })
    })

    const mockMissedPayments = [
      {
        _id: 'v1',
        agreement: null,
        status: 'accepted'
      }
    ]

    vi.mocked(versionsModel.find).mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockMissedPayments)
      })
    })

    sendUnsetGPSEventsPlugin.register(server)
    const startHandler = server.events.on.mock.calls.find(
      (call) => call[0] === 'start'
    )[1]

    await startHandler()

    expect(server.logger.error).toHaveBeenCalledWith(
      'Agreement number not found for version v1'
    )
    expect(sendGrantPaymentEvent).not.toHaveBeenCalled()
  })

  it('should handle errors gracefully while fetching missed payments', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') return true
      return null
    })

    vi.mocked(agreementsModel.find).mockImplementation(() => {
      throw new Error('Database connection failed')
    })

    sendUnsetGPSEventsPlugin.register(server)
    const startHandler = server.events.on.mock.calls.find(
      (call) => call[0] === 'start'
    )[1]

    await startHandler()

    expect(server.logger.error).toHaveBeenCalledWith(
      'Error while checking for missed GPS payments events: Database connection failed'
    )
  })
})
