import crypto from 'node:crypto'

import { Verifier } from '@pact-foundation/pact'

import { createServer } from '~/src/api/index.js'
import { config } from '~/src/config/index.js'

jest.unmock('mongoose')

jest.mock('~/src/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: jest.fn().mockResolvedValue(true)
}))

let server

describe('UI sending a GET request to get an agreement', () => {
  beforeAll(async () => {
    // Use the MongoDB URI provided by @shelf/jest-mongodb
    const mongoUri = globalThis.__MONGO_URI__

    // Configure the application
    config.set('port', crypto.randomInt(30001, 65535))
    config.set('isJwtEnabled', false)
    config.set('mongoUri', mongoUri)
    config.set('featureFlags.seedDb', true)

    // Create and start the server
    server = await createServer({ disableSQS: true })
    await server.start()
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
      providerBaseUrl: `http://localhost:${config.get('port')}` // server.info.uri,
      // logLevel: 'debug'
    }

    const verify = await new Verifier(pactOpts).verifyProvider()
    expect(verify).toBeTruthy()

    return verify
  })
})
