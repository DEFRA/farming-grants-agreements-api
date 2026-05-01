import { vi, describe, it, expect, beforeEach } from 'vitest'
import { sendUnsetGPSEventsPlugin } from './send-unsent-gps-events.js'
import { config } from '#~/config/index.js'
import { sendGrantPaymentEvent } from '#~/api/common/helpers/send-grant-payment-event.js'
import { acceptOffer } from '#~/api/agreement/helpers/accept-offer.js'
import { calculatePaymentsBasedOnParcelsWithActions } from '#~/api/adapter/land-grants-adapter.js'
import versionsModel from '#~/api/common/models/versions.js'
import grantModel from '#~/api/common/models/grant.js'

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
      if (key === 'serviceName') {
        return 'test-service'
      }
      if (key === 'serviceVersion') {
        return '1.0.0'
      }
      if (key === 'paymentDayOfMonth') {
        return 15
      }
      return null
    })
  }
}))
vi.mock('#~/api/common/helpers/send-grant-payment-event.js')
vi.mock('#~/api/agreement/helpers/accept-offer.js')
vi.mock('#~/api/adapter/land-grants-adapter.js')
vi.mock('#~/api/common/models/versions.js')
vi.mock('#~/api/common/models/grant.js')

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
      if (key === 'featureFlags.sendUnsentGPSEvents') {
        return false
      }
      return null
    })
    sendUnsetGPSEventsPlugin.register(server)
    expect(server.events.on).not.toHaveBeenCalled()
    expect(server.logger.info).not.toHaveBeenCalled()
    expect(server.logger.error).not.toHaveBeenCalled()
  })

  it('should register start event listener if feature flag is enabled', () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') {
        return true
      }
      return null
    })
    sendUnsetGPSEventsPlugin.register(server)
    expect(server.events.on).toHaveBeenCalledWith('start', expect.any(Function))
  })

  it('should process missed payments on start', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') {
        return true
      }
      if (key === 'aws.sns.topic.createPayment.arn') {
        return 'arn:test'
      }
      if (key === 'aws.sns.topic.createPayment.type') {
        return 'test.type'
      }
      return null
    })

    const mockGrants = [{ _id: { toString: () => 'grant1' } }]

    vi.mocked(grantModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockGrants)
      })
    })

    const mockPayment = {
      agreementTotalPence: 1000,
      annualTotalPence: 500,
      agreementStartDate: '2025-01-01',
      agreementEndDate: '2025-12-31',
      frequency: 'quarterly',
      payments: [{ totalPaymentPence: 250, paymentDate: '2025-03-31' }]
    }

    const mockMissedPayments = [
      {
        _id: 'v1',
        grant: { agreementNumber: 'AG1' },
        status: 'accepted',
        application: { parcel: [{ sheetId: '1', parcelId: '1', actions: [] }] },
        payment: mockPayment
      }
    ]

    const populateMock = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockMissedPayments)
    })

    vi.mocked(versionsModel.find).mockReturnValue({
      populate: populateMock
    })

    vi.mocked(calculatePaymentsBasedOnParcelsWithActions).mockResolvedValue(
      mockPayment
    )

    const newVersion = {
      _id: 'v2',
      grant: { agreementNumber: 'AG1' },
      status: 'accepted',
      application: { parcel: [{ sheetId: '1', parcelId: '1', actions: [] }] },
      payment: mockPayment,
      toObject: () => ({
        _id: 'v2',
        grant: { agreementNumber: 'AG1' },
        status: 'accepted',
        application: { parcel: [{ sheetId: '1', parcelId: '1', actions: [] }] },
        payment: mockPayment
      })
    }

    vi.mocked(versionsModel.create).mockResolvedValue(newVersion)
    vi.mocked(versionsModel.findById).mockImplementation((id) => {
      if (id === 'v2') {
        return {
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(newVersion.toObject())
          })
        }
      }
      return {
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null)
        })
      }
    })

    vi.mocked(acceptOffer).mockResolvedValue({
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
      grant: { $in: ['grant1'] },
      'payment.agreementStartDate': { $lt: '2026-05-01' }
    })

    expect(populateMock).toHaveBeenCalledWith('grant')

    expect(acceptOffer).toHaveBeenCalledWith(
      'AG1',
      expect.objectContaining({
        _id: 'v2',
        grant: { agreementNumber: 'AG1' },
        status: 'accepted',
        application: { parcel: [{ sheetId: '1', parcelId: '1', actions: [] }] },
        payment: mockPayment
      }),
      server.logger,
      null
    )
  })

  it('should handle errors gracefully during processing', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') {
        return true
      }
      return null
    })

    const mockGrants = [{ _id: { toString: () => 'grant1' } }]

    vi.mocked(grantModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockGrants)
      })
    })

    const mockPayment = {
      agreementTotalPence: 1000,
      annualTotalPence: 500,
      agreementStartDate: '2025-01-01',
      agreementEndDate: '2025-12-31',
      frequency: 'quarterly',
      payments: [{ totalPaymentPence: 250, paymentDate: '2025-03-31' }]
    }

    const mockMissedPayments = [
      {
        _id: 'v1',
        grant: { agreementNumber: 'AG1' },
        status: 'accepted',
        application: { parcel: [{ sheetId: '1', parcelId: '1', actions: [] }] },
        payment: mockPayment
      }
    ]

    vi.mocked(versionsModel.find).mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockMissedPayments)
      })
    })

    // Mock payment calculation to throw an error
    vi.mocked(calculatePaymentsBasedOnParcelsWithActions).mockRejectedValue(
      new Error('Test error')
    )

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
      if (key === 'featureFlags.sendUnsentGPSEvents') {
        return true
      }
      return null
    })

    const mockGrants = [{ _id: { toString: () => 'grant1' } }]

    vi.mocked(grantModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockGrants)
      })
    })

    const mockMissedPayments = [
      {
        _id: 'v1',
        grant: null,
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
      if (key === 'featureFlags.sendUnsentGPSEvents') {
        return true
      }
      return null
    })

    vi.mocked(grantModel.find).mockImplementation(() => {
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

  it('should create new version when payment values have changed & set the previous version status to cancelled', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') {
        return true
      }
      return null
    })

    const mockGrants = [{ _id: { toString: () => 'grant1' } }]

    vi.mocked(grantModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockGrants)
      })
    })

    const oldPayment = {
      agreementTotalPence: 1000,
      annualTotalPence: 500,
      agreementStartDate: '2025-01-01',
      agreementEndDate: '2025-12-31',
      frequency: 'quarterly',
      payments: [{ totalPaymentPence: 250, paymentDate: '2025-03-31' }]
    }

    const newPayment = {
      agreementTotalPence: 1200,
      annualTotalPence: 600,
      agreementStartDate: '2025-01-01',
      agreementEndDate: '2025-12-31',
      frequency: 'quarterly',
      payments: [{ totalPaymentPence: 300, paymentDate: '2025-03-31' }]
    }

    const mockMissedPayments = [
      {
        _id: 'v1',
        grant: { agreementNumber: 'AG1', _id: 'grant1' },
        status: 'accepted',
        payment: oldPayment,
        application: { parcel: [{ sheetId: '1', parcelId: '1', actions: [] }] }
      }
    ]

    vi.mocked(versionsModel.find).mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockMissedPayments)
      })
    })

    vi.mocked(calculatePaymentsBasedOnParcelsWithActions).mockResolvedValue(
      newPayment
    )

    const newVersion = {
      _id: 'v2',
      ...mockMissedPayments[0],
      payment: newPayment,
      toObject: () => ({
        _id: 'v2',
        ...mockMissedPayments[0],
        payment: newPayment
      })
    }

    vi.mocked(versionsModel.create).mockResolvedValue(newVersion)
    vi.mocked(versionsModel.findById).mockImplementation((id) => {
      if (id === 'v2') {
        return {
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(newVersion.toObject())
          })
        }
      }
      return {
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null)
        })
      }
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
      'Creating new version of AG1'
    )
    expect(calculatePaymentsBasedOnParcelsWithActions).toHaveBeenCalledWith({
      parcels: mockMissedPayments[0].application.parcel,
      startDate: mockMissedPayments[0].payment.agreementStartDate,
      logger: server.logger
    })
    expect(versionsModel.create).toHaveBeenCalled()

    // Verify that the original version's status is set to cancelled
    expect(versionsModel.updateOne).toHaveBeenCalledWith(
      { _id: 'v1' },
      { $set: { status: 'cancelled' } }
    )
  })

  it('should create a new version of the agreement for unsent payments', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') {
        return true
      }
      return null
    })

    const mockGrants = [{ _id: { toString: () => 'grant1' } }]

    vi.mocked(grantModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockGrants)
      })
    })

    const payment = {
      agreementTotalPence: 1000,
      annualTotalPence: 500,
      agreementStartDate: '2025-01-01',
      agreementEndDate: '2025-12-31',
      frequency: 'quarterly',
      payments: [{ totalPaymentPence: 250, paymentDate: '2025-03-31' }]
    }

    const mockMissedPayments = [
      {
        _id: 'v1',
        grant: { agreementNumber: 'AG1', _id: 'grant1' },
        status: 'accepted',
        payment,
        application: { parcel: [{ sheetId: '1', parcelId: '1', actions: [] }] }
      }
    ]

    vi.mocked(versionsModel.find).mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockMissedPayments)
      })
    })

    vi.mocked(calculatePaymentsBasedOnParcelsWithActions).mockResolvedValue(
      payment
    )

    const newVersion = {
      ...mockMissedPayments[0],
      _id: 'v2',
      payment,
      toObject: () => ({
        ...mockMissedPayments[0],
        _id: 'v2',
        payment
      })
    }

    vi.mocked(versionsModel.create).mockResolvedValue(newVersion)
    vi.mocked(versionsModel.findById).mockImplementation((id) => {
      if (id === 'v2') {
        return {
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(newVersion.toObject())
          })
        }
      }
      return {
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null)
        })
      }
    })

    vi.mocked(acceptOffer).mockResolvedValue({
      claimId: 'C1',
      some: 'data'
    })

    sendUnsetGPSEventsPlugin.register(server)
    const startHandler = server.events.on.mock.calls.find(
      (call) => call[0] === 'start'
    )[1]

    await startHandler()

    expect(server.logger.info).toHaveBeenCalledWith(
      'Creating new version of AG1'
    )
    expect(calculatePaymentsBasedOnParcelsWithActions).toHaveBeenCalledWith({
      parcels: mockMissedPayments[0].application.parcel,
      startDate: mockMissedPayments[0].payment.agreementStartDate,
      logger: server.logger
    })
    expect(versionsModel.create).toHaveBeenCalled()
    expect(acceptOffer).toHaveBeenCalledWith(
      'AG1',
      expect.objectContaining({
        _id: 'v2',
        grant: { agreementNumber: 'AG1', _id: 'grant1' },
        status: 'accepted',
        payment,
        application: { parcel: [{ sheetId: '1', parcelId: '1', actions: [] }] }
      }),
      server.logger,
      null
    )
  })

  it('should handle payment calculation errors gracefully', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') {
        return true
      }
      return null
    })

    const mockGrants = [{ _id: { toString: () => 'grant1' } }]

    vi.mocked(grantModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockGrants)
      })
    })

    const mockMissedPayments = [
      {
        _id: 'v1',
        grant: { agreementNumber: 'AG1', _id: 'grant1' },
        status: 'accepted',
        payment: { agreementStartDate: '2025-01-01' },
        application: { parcel: [{ sheetId: '1', parcelId: '1', actions: [] }] }
      }
    ]

    vi.mocked(versionsModel.find).mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockMissedPayments)
      })
    })

    vi.mocked(calculatePaymentsBasedOnParcelsWithActions).mockRejectedValue(
      new Error('Payment calculation failed')
    )

    sendUnsetGPSEventsPlugin.register(server)
    const startHandler = server.events.on.mock.calls.find(
      (call) => call[0] === 'start'
    )[1]

    await startHandler()

    expect(server.logger.error).toHaveBeenCalledWith(
      'Failed to process missed payment for agreement AG1: Payment calculation failed'
    )
    expect(sendGrantPaymentEvent).not.toHaveBeenCalled()
  })

  it('should handle errors when creating new version fails', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'featureFlags.sendUnsentGPSEvents') {
        return true
      }
      return null
    })

    const mockGrants = [{ _id: { toString: () => 'grant1' } }]

    vi.mocked(grantModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockGrants)
      })
    })

    const oldPayment = {
      agreementTotalPence: 1000,
      annualTotalPence: 500,
      agreementStartDate: '2025-01-01',
      agreementEndDate: '2025-12-31',
      frequency: 'quarterly',
      payments: [{ totalPaymentPence: 250, paymentDate: '2025-03-31' }]
    }

    const newPayment = {
      agreementTotalPence: 1500,
      annualTotalPence: 500,
      agreementStartDate: '2025-01-01',
      agreementEndDate: '2025-12-31',
      frequency: 'quarterly',
      payments: [{ totalPaymentPence: 250, paymentDate: '2025-03-31' }]
    }

    const mockMissedPayments = [
      {
        _id: 'v1',
        grant: { agreementNumber: 'AG1', _id: 'grant1' },
        status: 'accepted',
        payment: oldPayment,
        application: { parcel: [{ sheetId: '1', parcelId: '1', actions: [] }] }
      }
    ]

    vi.mocked(versionsModel.find).mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockMissedPayments)
      })
    })

    vi.mocked(calculatePaymentsBasedOnParcelsWithActions).mockResolvedValue(
      newPayment
    )

    vi.mocked(versionsModel.create).mockRejectedValue(
      new Error('Database error')
    )

    sendUnsetGPSEventsPlugin.register(server)
    const startHandler = server.events.on.mock.calls.find(
      (call) => call[0] === 'start'
    )[1]

    await startHandler()

    expect(server.logger.error).toHaveBeenCalledWith(
      'Failed to process missed payment for agreement AG1: Database error'
    )
  })
})
