import { jest } from '@jest/globals'
import path from 'node:path'
import crypto from 'node:crypto'

import { Pact } from '@pact-foundation/pact'
import fetchMock from 'jest-fetch-mock'

import { createServer } from '~/src/api/index.js'
import { config } from '~/src/config/index.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'
import { seedDatabase } from '~/src/api/common/helpers/seed-database.js'
import agreements from '~/src/api/common/helpers/sample-data/agreements.js'

jest.unmock('mongoose')

const calculatedPayment = {
  message: 'success',
  payment: {
    agreementStartDate: '2025-12-01',
    agreementEndDate: '2028-12-01',
    frequency: 'Quarterly',
    agreementTotalPence: 242298,
    annualTotalPence: 80766,

    parcelItems: {
      1: {
        code: 'CMOR1',
        description: 'Assess moorland',
        unit: 'ha',
        quantity: 50.53,
        rateInPence: 1060,
        annualPaymentPence: 53566,
        parcelId: 'SE12 3456 7890',
        version: 1
      }
    },

    agreementLevelItems: {
      1: {
        code: 'CMOR1',
        description: 'Agreement-level item',
        annualPaymentPence: 27200,
        version: 1
      }
    },

    payments: [
      {
        paymentDate: '2026-03-05',
        totalPaymentPence: 20197,
        lineItems: [{ agreementLevelItemId: 1, paymentPence: 20197 }]
      },
      {
        paymentDate: '2026-06-05',
        totalPaymentPence: 20191,
        lineItems: [{ agreementLevelItemId: 1, paymentPence: 20191 }]
      },
      {
        paymentDate: '2026-09-07',
        totalPaymentPence: 20191,
        lineItems: [{ agreementLevelItemId: 1, paymentPence: 20191 }]
      },
      {
        paymentDate: '2026-12-07',
        totalPaymentPence: 20191,
        lineItems: [{ agreementLevelItemId: 1, paymentPence: 20191 }]
      }
    ]
  }
}

jest.mock('~/src/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: jest.fn().mockResolvedValue(true)
}))

let server
let originalFetch

describe('UI sending a POST request to accept an agreement', () => {
  const provider = new Pact({
    consumer: 'farming-grants-agreements-api-rest',
    provider: 'payment-hub-rest',
    dir: path.resolve('src', 'contracts', 'consumer', 'pacts'),
    pactfileWriteMode: 'update',
    logLevel: 'info'
  })

  beforeAll(async () => {
    // Turn off jest-fetch-mock for this test file
    fetchMock.disableMocks()

    // Save and replace global.fetch with a Jest mock
    originalFetch = global.fetch
    // Mock Land Grants payment calculation HTTP call to avoid real network fetches
    // Return the structure that landgrantsAdapter expects, including headers
    global.fetch = jest.fn((url, options) => {
      const urlStr = String(url)
      if (urlStr.includes('/payments/calculate')) {
        return Promise.resolve({
          ok: true,
          headers: { get: jest.fn().mockReturnValue('application/json') },
          json: jest.fn().mockResolvedValue(calculatedPayment)
        })
      }
      // Delegate all other requests (e.g., Payment Hub) to the real fetch
      return originalFetch(url, options)
    })

    // Use the MongoDB URI provided by @shelf/jest-mongodb
    const mongoUri = globalThis.__MONGO_URI__

    // Configure the application
    config.set('port', crypto.randomInt(30001, 65535))
    config.set('mongoUri', mongoUri)
    config.set('files.s3.bucket', 'mockBucket')
    config.set('files.s3.region', 'mockRegion')
    config.set('featureFlags.isPaymentHubEnabled', true)
    config.set('featureFlags.seedDb', false)

    // Mock JWT auth functions to return valid authorization by default
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
      valid: true,
      source: 'defra',
      sbi: '106284736'
    })

    // Create and start the server
    server = await createServer({ disableSQS: true })
    await server.initialize()
    await seedDatabase(console, [agreements[1]])
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }
    config.set('featureFlags.isPaymentHubEnabled', false)

    // Restore original fetch and re-enable jest-fetch-mock for other tests
    global.fetch = originalFetch
    fetchMock.enableMocks()
  })

  it('should send a request to payment hub to setup a new payment schedule', async () => {
    return await provider
      .addInteraction()
      .given('A customer has an agreement offer')
      .uponReceiving('a request from the customer to accept their offer')
      .withRequest('POST', '/messages', (builder) => {
        builder.headers({ 'Content-Type': 'application/json' })
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'text/plain; charset=utf-8' })
      })
      .executeTest(async (mockServer) => {
        config.set('paymentHub.uri', mockServer.url)

        const { statusCode, result } = await server.inject({
          method: 'POST',
          url: '/',
          headers: {
            'x-encrypted-auth': 'valid-jwt-token'
          }
        })

        expect(statusCode).toBe(200)
        expect(result.agreementData.status).toContain('accepted')
        expect(result.agreementData.agreement.agreementNumber).toContain('SFI')
      })
  })
})
