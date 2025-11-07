import crypto from 'node:crypto'

import { Verifier } from '@pact-foundation/pact'

import { createServer } from '~/src/api/index.js'
import { config } from '~/src/config/index.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'
import { seedDatabase } from '~/src/api/common/helpers/seed-database.js'
import agreements from '~/src/api/common/helpers/sample-data/agreements.js'

jest.unmock('mongoose')

jest.mock('~/src/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: jest.fn().mockResolvedValue(true)
}))

let server

// Reason: Pact test seems to be timing out and needs investigation
describe('UI sending a GET request to get an agreement', () => {
  beforeAll(async () => {
    // Use the MongoDB URI provided by @shelf/jest-mongodb
    const mongoUri = globalThis.__MONGO_URI__

    // Configure the application
    config.set('port', crypto.randomInt(30001, 65535))
    config.set('mongoUri', mongoUri)
    config.set('files.s3.bucket', 'mockBucket')
    config.set('files.s3.region', 'mockRegion')
    config.set('featureFlags.seedDb', false)
    config.set('featureFlags.isPaymentHubEnabled', false)

    // Mock JWT auth functions to return valid authorization by default
    jest.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
      valid: true,
      source: 'defra',
      sbi: '106284736'
    })

    // Create and start the server
    server = await createServer({ disableSQS: true })
    await server.start()
    await seedDatabase(console, [agreements[1]])
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }
  })

  it('should validate the expectations of the UI', async () => {
    const pactOpts = {
      provider: 'farming-grants-agreements-api-rest',
      consumer: 'farming-grants-agreements-ui-rest',
      pactBrokerUrl:
        process.env.PACT_BROKER_URL ??
        'https://ffc-pact-broker.azure.defra.cloud',
      consumerVersionSelectors: [{ latest: true }],
      pactBrokerUsername: process.env.PACT_BROKER_USERNAME,
      pactBrokerPassword: process.env.PACT_BROKER_PASSWORD,
      publishVerificationResult: true,
      providerVersion: process.env.SERVICE_VERSION ?? '1.0.0',
      providerBaseUrl: `http://localhost:${config.get('port')}`,
      requestFilter: (req, res, next) => {
        // Disable Pact setup calls, as we setup the server in the before steps
        req.url = `/${req.url.replace('_pactSetup', '')}`
        next()
      }
    }

    const verify = await new Verifier(pactOpts).verifyProvider()
    expect(verify).toBeTruthy()

    return verify
  })
})
