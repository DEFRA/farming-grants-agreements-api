import { vi } from 'vitest'

import crypto from 'node:crypto'

import { Pact } from '@pact-foundation/pact'

import { createServer } from '~/src/api/index.js'
import { config } from '~/src/config/index.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'
import { seedDatabase } from '~/src/api/common/helpers/seed-database.js'
import agreements from '~/src/api/common/helpers/sample-data/agreements.js'
import { withPactDir } from '~/src/contracts/consumer/pact-test-helpers.js'

vi.unmock('mongoose')

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

vi.mock('~/src/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(true)
}))

let server
let originalFetch

// Reason: Pending actual request/response data from payment hub service
describe.skip('UI sending a POST request to accept an agreement', () => {
  const provider = new Pact({
    consumer: 'farming-grants-agreements-api',
    provider: 'payment-hub',
    logLevel: process.env.CI ? 'warn' : 'info',
    ...withPactDir(import.meta.url)
  })

  beforeAll(async () => {
    // Replace global.fetch with a Vitest spy for the duration of this test
    originalFetch = global.fetch
    global.fetch = vi.fn((url, options) => {
      const urlStr = String(url)
      if (urlStr.includes('/payments/calculate')) {
        return Promise.resolve({
          ok: true,
          headers: { get: vi.fn().mockReturnValue('application/json') },
          json: vi.fn().mockResolvedValue(calculatedPayment)
        })
      }
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
    vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
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
    // Restore original fetch
    global.fetch = originalFetch
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
