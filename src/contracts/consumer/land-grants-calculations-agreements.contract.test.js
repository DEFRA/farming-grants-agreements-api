import { vi } from 'vitest'
import { fetch as undiciFetch } from 'undici'

import crypto from 'node:crypto'

import { Pact, MatchersV2 } from '@pact-foundation/pact'

import { createServer } from '#~/api/index.js'
import { config } from '#~/config/index.js'
import * as jwtAuth from '#~/api/common/helpers/jwt-auth.js'
import { seedDatabase } from '#~/api/common/helpers/seed-database.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'
import { withPactDir } from '#~/contracts/test-helpers/pact.js'
import { buildIsolatedMongoOptions } from '#~/contracts/test-helpers/mongo.js'

const { like, iso8601Date, eachLike } = MatchersV2

vi.unmock('mongoose')

vi.mock('#~/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(true)
}))

let server
let originalFetch

describe('UI sending a POST request to accept an agreement', () => {
  const provider = new Pact({
    consumer: 'farming-grants-agreements-api',
    provider: 'land-grants-api',
    logLevel: process.env.CI ? 'warn' : 'info',
    ...withPactDir(import.meta.url)
  })

  beforeAll(async () => {
    // Restore real fetch to allow Pact to make real HTTP requests
    // Save the mocked fetch and replace with real implementation
    originalFetch = global.fetch
    global.fetch = undiciFetch

    const mongoOverrides = buildIsolatedMongoOptions('land-grants-contract')

    // Configure the application
    config.set('port', crypto.randomInt(30001, 65535))
    config.set('mongoUri', mongoOverrides.mongoUrl)
    config.set('files.s3.bucket', 'mockBucket')
    config.set('files.s3.region', 'mockRegion')
    config.set('featureFlags.isPaymentHubEnabled', false)
    config.set('featureFlags.seedDb', false)
    config.set('landGrants.token', 'mock-token')

    // Mock JWT auth functions to return valid authorization by default
    vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
      valid: true,
      source: 'defra',
      sbi: '106284736'
    })

    // Create and start the server
    server = await createServer({
      disableSQS: true,
      ...mongoOverrides
    })
    await server.initialize()
    await seedDatabase(console, [sampleData.agreements[1]])
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }
    // Restore the mocked fetch for other tests
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  it('should send a GET request to land grants to get the calculations', async () => {
    const calculatedPayment = {
      message: like('success'),
      payment: {
        agreementStartDate: iso8601Date('2025-09-01'),
        agreementEndDate: iso8601Date('2028-09-01'),
        frequency: like('Quarterly'),
        agreementTotalPence: like(96018),
        annualTotalPence: like(32006),

        parcelItems: like({
          1: {
            code: like('CMOR1'),
            description: like(
              'CMOR1: Assess moorland and produce a written record'
            ),
            unit: like('ha'),
            quantity: like(4.53411078),
            rateInPence: like(1060),
            annualPaymentPence: like(4806),
            parcelId: like('8083'),
            sheetId: like('SD6743'),
            version: like(1)
          }
        }),

        agreementLevelItems: like({
          1: {
            code: like('CMOR1'),
            description: like(
              'CMOR1: Assess moorland and produce a written record'
            ),
            annualPaymentPence: like(27200),
            version: like(1)
          }
        }),

        payments: eachLike({
          paymentDate: iso8601Date('2025-12-05'),
          totalPaymentPence: like(8007),
          lineItems: eachLike({
            paymentPence: like(1204)
          })
        })
      }
    }

    return await provider
      .addInteraction()
      .given('has parcels', {
        parcels: [
          { sheetId: 'SD6743', parcelId: '8083' },
          { sheetId: 'SD6743', parcelId: '8333' }
        ]
      })
      .uponReceiving('a request from the customer to view their offer')
      .withRequest('POST', '/payments/calculate', (builder) => {
        builder.headers({
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token'
        })
        builder.jsonBody({
          parcel: [
            {
              sheetId: 'SD6743',
              parcelId: '8083',
              actions: [{ code: 'CMOR1', quantity: 4.7575 }]
            },
            {
              sheetId: 'SD6743',
              parcelId: '8333',
              actions: [{ code: 'CMOR1', quantity: 2.1705 }]
            }
          ]
        })
      })

      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json; charset=utf-8' })
        builder.jsonBody(calculatedPayment)
      })
      .executeTest(async (mockServer) => {
        config.set('landGrants.uri', mockServer.url)

        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: '/',
          headers: {
            'x-encrypted-auth': 'valid-jwt-token'
          }
        })

        expect(statusCode).toBe(200)
        expect(result.agreementData.agreementNumber).toContain('FPTT')
        expect(result.agreementData.payment.agreementTotalPence).toBe(96018)
      })
  })
})
