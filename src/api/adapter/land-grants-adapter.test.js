import { vi } from 'vitest'
import {
  calculatePaymentsBasedOnParcelsWithActions,
  toLandGrantsPayload,
  convertParcelsToLandGrantsPayload
} from './land-grants-adapter.js'
import { config } from '#~/config/index.js'

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn()
  }
}))

const mockConfig = config

describe('toLandGrantsPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('throws when actions is not an array', () => {
    expect(() => toLandGrantsPayload('not-an-array')).toThrow(TypeError)
  })

  test('groups valid actions by sheet and parcel while discarding invalid entries', () => {
    const result = toLandGrantsPayload([
      {
        sheetId: 'sheet-1',
        parcelId: 'parcel-1',
        code: 'A1',
        appliedFor: { quantity: '10.5' }
      },
      {
        sheetId: 'sheet-1',
        parcelId: 'parcel-1',
        code: 'A2',
        appliedFor: { quantity: 5 }
      },
      {
        sheetId: 'sheet-2',
        parcelId: 'parcel-9',
        code: 'B1',
        appliedFor: { quantity: '1' }
      },
      {
        sheetId: 'sheet-2',
        parcelId: 'parcel-9',
        code: 'B2',
        appliedFor: { quantity: 'banana' }
      },
      {
        sheetId: 'sheet-2',
        parcelId: 'parcel-9',
        appliedFor: { quantity: 3 }
      },
      {
        sheetId: 'sheet-1',
        parcelId: 'parcel-1',
        code: 'A3',
        appliedFor: { quantity: 0 }
      }
    ])

    expect(result).toEqual({
      parcel: [
        {
          sheetId: 'sheet-1',
          parcelId: 'parcel-1',
          actions: [
            { code: 'A1', quantity: 10.5 },
            { code: 'A2', quantity: 5 }
          ]
        },
        {
          sheetId: 'sheet-2',
          parcelId: 'parcel-9',
          actions: [{ code: 'B1', quantity: 1 }]
        }
      ]
    })
  })

  test('converts Decimal128-like values to numbers', () => {
    const decimalLike = { toString: () => '4.25' }
    const result = toLandGrantsPayload([
      {
        sheetId: 'sheet-3',
        parcelId: 'parcel-9',
        code: 'DX1',
        appliedFor: { quantity: decimalLike }
      }
    ])

    expect(result).toEqual({
      parcel: [
        {
          sheetId: 'sheet-3',
          parcelId: 'parcel-9',
          actions: [{ code: 'DX1', quantity: 4.25 }]
        }
      ]
    })
  })
})

describe('convertParcelsToLandGrantsPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('throws when parcels argument is not an array', () => {
    expect(() => convertParcelsToLandGrantsPayload(null)).toThrow(TypeError)
  })

  test('throws when parcel actions is not an array', () => {
    const parcel = { sheetId: 'A', parcelId: '1', actions: null }
    expect(() => convertParcelsToLandGrantsPayload([parcel])).toThrow(
      'parcel actions must be an array'
    )
  })

  test('skips invalid parcels and quantities while grouping valid entries', () => {
    const result = convertParcelsToLandGrantsPayload([
      {
        sheetId: 'sheet-1',
        parcelId: 'parcel-1',
        actions: [
          { code: 'X1', appliedFor: { quantity: '2.5' } },
          { code: 'X2', appliedFor: { quantity: '0' } },
          { code: 'X3', appliedFor: { quantity: 'pineapple' } }
        ]
      },
      {
        parcelId: 'parcel-2',
        actions: [{ code: 'INVALID', appliedFor: { quantity: 5 } }]
      },
      {
        sheetId: 'sheet-3',
        parcelId: 'parcel-9',
        actions: [{ code: 'Z1', appliedFor: { quantity: 1 } }]
      }
    ])

    expect(result).toEqual({
      parcel: [
        {
          sheetId: 'sheet-1',
          parcelId: 'parcel-1',
          actions: [{ code: 'X1', quantity: 2.5 }]
        },
        {
          sheetId: 'sheet-3',
          parcelId: 'parcel-9',
          actions: [{ code: 'Z1', quantity: 1 }]
        }
      ]
    })
  })

  test('parses Decimal128-like values from parcels', () => {
    const decimalLike = { toString: () => '3.14' }
    const result = convertParcelsToLandGrantsPayload([
      {
        sheetId: 'sheet-5',
        parcelId: 'parcel-3',
        actions: [{ code: 'PIE', appliedFor: { quantity: decimalLike } }]
      }
    ])

    expect(result).toEqual({
      parcel: [
        {
          sheetId: 'sheet-5',
          parcelId: 'parcel-3',
          actions: [{ code: 'PIE', quantity: 3.14 }]
        }
      ]
    })
  })
})

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
        version: 1,
        durationYears: 3,
        appliedFor: {
          unit: 'ha',
          quantity: 4.7575
        }
      },
      {
        code: 'UPL3',
        version: 1,
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
        version: 1,
        durationYears: 3,
        appliedFor: {
          unit: 'ha',
          quantity: 2.1705
        }
      },
      {
        code: 'UPL1',
        version: 1,
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
      'https://land-grants.example/payments/calculate'
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
