import { vi } from 'vitest'
import { calculatePaymentsBasedOnParcelsWithActions } from './land-grants-adapter.js'
import { config } from '#~/config/index.js'

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn()
  }
}))

const mockConfig = config

const parcelsWithActions = [
  {
    sheetId: 'SK0971',
    parcelId: '7555',
    area: {
      unit: 'ha',
      quantity: 5.2182
    },
    actions: [
      {
        code: 'CMOR1',
        version: '1',
        durationYears: 3,
        appliedFor: {
          unit: 'ha',
          quantity: 4.7575
        }
      },
      {
        code: 'UPL3',
        version: '1',
        durationYears: 3,
        appliedFor: {
          unit: 'ha',
          quantity: 4.7575
        }
      }
    ]
  },
  {
    sheetId: 'SK0971',
    parcelId: '9194',
    area: {
      unit: 'ha',
      quantity: 2.1703
    },
    actions: [
      {
        code: 'CMOR1',
        version: '1',
        durationYears: 3,
        appliedFor: {
          unit: 'ha',
          quantity: 2.1705
        }
      },
      {
        code: 'UPL1',
        version: '1',
        durationYears: 3,
        appliedFor: {
          unit: 'ha',
          quantity: 2.1705
        }
      }
    ]
  }
]

const globalFetch = global.fetch

const buildFetchResponse = (overrides = {}) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: {
    get: () => 'application/json'
  },
  json: vi.fn().mockResolvedValue({}),
  text: vi.fn().mockResolvedValue(''),
  ...overrides
})

const mockLogger = {
  error: vi.fn(),
  info: vi.fn()
}

beforeAll(() => {
  global.fetch = vi.fn()
})

afterAll(() => {
  global.fetch = globalFetch
})

beforeEach(() => {
  vi.clearAllMocks()
  mockConfig.get.mockImplementation((key) => {
    if (key === 'landGrants.uri') {
      return 'https://land-grants.example'
    }
    if (key === 'landGrants.token') {
      return 'config-token'
    }
    if (key === 'landGrants.calculationUri') {
      return '/api/v2/payments/calculate'
    }
    if (key === 'fetchTimeout') {
      return 30000
    }
    throw new Error(`Unexpected config key ${key}`)
  })
})

describe('calculatePaymentsBasedOnParcelsWithActions', () => {
  test('sends grouped payload and returns the payment fields', async () => {
    const payment = {
      agreementStartDate: '2024-01-01',
      agreementEndDate: '2025-01-01',
      frequency: 'Quarterly',
      agreementTotalPence: 12300,
      annualTotalPence: 4100,
      parcelItems: [{ id: 'parcel' }],
      agreementLevelItems: [{ id: 'agreement-level' }],
      payments: [{ dueDate: '2024-03-01', amount: 1025 }],
      extraneous: 'ignore-me'
    }

    const responseBody = { payment }
    const fetchResponse = buildFetchResponse({
      json: vi.fn().mockResolvedValue(responseBody),
      text: vi.fn().mockResolvedValue(JSON.stringify(responseBody))
    })
    global.fetch.mockResolvedValue(fetchResponse)

    const result = await calculatePaymentsBasedOnParcelsWithActions(
      parcelsWithActions,
      mockLogger
    )

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, request] = global.fetch.mock.calls[0]
    expect(url.toString()).toBe(
      'https://land-grants.example/api/v2/payments/calculate'
    )
    expect(request.headers.Authorization).toBe('Bearer config-token')
    expect(request.headers['Content-Type']).toBe('application/json')
    expect(request.body).toEqual(
      JSON.stringify({
        parcel: [
          {
            sheetId: 'SK0971',
            parcelId: '7555',
            actions: [
              { code: 'CMOR1', quantity: 4.7575 },
              { code: 'UPL3', quantity: 4.7575 }
            ]
          },
          {
            sheetId: 'SK0971',
            parcelId: '9194',
            actions: [
              { code: 'CMOR1', quantity: 2.1705 },
              { code: 'UPL1', quantity: 2.1705 }
            ]
          }
        ]
      })
    )

    expect(result).toEqual({
      agreementStartDate: payment.agreementStartDate,
      agreementEndDate: payment.agreementEndDate,
      frequency: payment.frequency,
      agreementTotalPence: payment.agreementTotalPence,
      annualTotalPence: payment.annualTotalPence,
      parcelItems: payment.parcelItems,
      agreementLevelItems: payment.agreementLevelItems,
      payments: payment.payments
    })

    expect(mockLogger.info).toHaveBeenCalledTimes(2)
  })

  test('handles calls without a logger provided', async () => {
    const payment = {
      agreementStartDate: '2026-01-01',
      agreementEndDate: '2027-01-01',
      frequency: 'Annually',
      agreementTotalPence: 999,
      annualTotalPence: 999,
      parcelItems: [],
      agreementLevelItems: [],
      payments: []
    }

    const responseBody = { payment }
    const fetchResponse = buildFetchResponse({
      json: vi.fn().mockResolvedValue(responseBody),
      text: vi.fn().mockResolvedValue(JSON.stringify(responseBody))
    })
    global.fetch.mockResolvedValue(fetchResponse)

    const result = await calculatePaymentsBasedOnParcelsWithActions(
      parcelsWithActions,
      null
    )

    expect(result).toEqual({
      agreementStartDate: payment.agreementStartDate,
      agreementEndDate: payment.agreementEndDate,
      frequency: payment.frequency,
      agreementTotalPence: payment.agreementTotalPence,
      annualTotalPence: payment.annualTotalPence,
      parcelItems: payment.parcelItems,
      agreementLevelItems: payment.agreementLevelItems,
      payments: payment.payments
    })

    expect(mockLogger.info).not.toHaveBeenCalled()
  })

  test('throws when Land Grants request does not include payment', async () => {
    const responseBody = {}
    const fetchResponse = buildFetchResponse({
      json: vi.fn().mockResolvedValue(responseBody),
      text: vi.fn().mockResolvedValue(JSON.stringify(responseBody))
    })
    global.fetch.mockResolvedValue(fetchResponse)

    await expect(
      calculatePaymentsBasedOnParcelsWithActions(parcelsWithActions, mockLogger)
    ).rejects.toThrow('Land Grants response missing "payment" field')

    expect(mockLogger.info).toHaveBeenCalledTimes(2)
  })

  test('throws when Land Grants request fails', async () => {
    const fetchResponse = {
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: vi.fn().mockResolvedValue('gateway down')
    }
    global.fetch.mockResolvedValue(fetchResponse)

    await expect(
      calculatePaymentsBasedOnParcelsWithActions(parcelsWithActions, mockLogger)
    ).rejects.toThrow(
      'Land Grants Payment calculate request failed: 502 Bad Gateway gateway down'
    )

    expect(mockLogger.info).toHaveBeenCalledTimes(1)
  })
})
