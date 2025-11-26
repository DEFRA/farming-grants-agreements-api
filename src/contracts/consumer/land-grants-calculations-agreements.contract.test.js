import { jest } from '@jest/globals'
import path from 'node:path'
import crypto from 'node:crypto'

import { Pact, MatchersV2 } from '@pact-foundation/pact'
import fetchMock from 'jest-fetch-mock'

import { createServer } from '~/src/api/index.js'
import { config } from '~/src/config/index.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'
import { seedDatabase } from '~/src/api/common/helpers/seed-database.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'

const { like, iso8601Date, eachLike } = MatchersV2

jest.unmock('mongoose')

jest.mock('~/src/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: jest.fn().mockResolvedValue(true)
}))

let server

describe('UI sending a POST request to accept an agreement', () => {
  const provider = new Pact({
    consumer: 'farming-grants-agreements-api-rest',
    provider: 'land-grants-api',
    dir: path.resolve('src', 'contracts', 'consumer', 'pacts'),
    pactfileWriteMode: 'update',
    logLevel: process.env.CI ? 'warn' : 'info'
  })

  beforeAll(async () => {
    fetchMock.disableMocks()

    // Use the MongoDB URI provided by @shelf/jest-mongodb
    const mongoUri = globalThis.__MONGO_URI__

    // Configure the application
    config.set('port', crypto.randomInt(30001, 65535))
    config.set('mongoUri', mongoUri)
    config.set('files.s3.bucket', 'mockBucket')
    config.set('files.s3.region', 'mockRegion')
    config.set('featureFlags.isPaymentHubEnabled', false)
    config.set('featureFlags.seedDb', false)
    config.set('landGrants.token', 'mock-token')

    // Mock JWT auth functions to return valid authorization by default
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
      valid: true,
      source: 'defra',
      sbi: '106284736'
    })

    // Create and start the server
    server = await createServer({ disableSQS: true })
    await server.initialize()
    await seedDatabase(console, [sampleData.agreements[1]])
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }

    fetchMock.enableFetchMocks()
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
      .given('A customer has an agreement offer')
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
              actions: [
                { code: 'CMOR1', quantity: 4.7575 },
                { code: 'UPL3', quantity: 4.7575 }
              ]
            },
            {
              sheetId: 'SD4842',
              parcelId: '4495',
              actions: [
                { code: 'CMOR1', quantity: 2.1705 },
                { code: 'UPL1', quantity: 2.1705 }
              ]
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
        expect(result.agreementData.agreementNumber).toContain('SFI')
        expect(result.agreementData.payment.agreementTotalPence).toBe(96018)
      })
  })
})
