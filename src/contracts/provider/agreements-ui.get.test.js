import { vi } from 'vitest'
import crypto from 'node:crypto'
import path from 'node:path'

import { Verifier } from '@pact-foundation/pact'

import { createServer } from '~/src/api/index.js'
import { config } from '~/src/config/index.js'
import * as jwtAuth from '~/src/api/common/helpers/jwt-auth.js'
import { seedDatabase } from '~/src/api/common/helpers/seed-database.js'
import agreements from '~/src/api/common/helpers/sample-data/agreements.js'
import { fetchWithTimeout } from '~/src/api/common/helpers/fetch.js'
import { acceptOffer } from '~/src/api/agreement/helpers/accept-offer.js'
import { getJsonPacts } from '~/src/contracts/test-helpers/pact.js'
import { buildIsolatedMongoOptions } from '~/src/contracts/test-helpers/mongo.js'

vi.unmock('mongoose')

vi.mock('~/src/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(true)
}))

vi.mock('~/src/api/common/helpers/fetch.js', () => ({
  fetchWithTimeout: vi.fn()
}))

let server

const localPactDir = path.resolve(
  process.cwd(),
  '../farming-grants-agreements-ui/src/contracts/consumer/pacts'
)

describe('UI sending a GET request to get an agreement', () => {
  beforeAll(async () => {
    const mongoOverrides = buildIsolatedMongoOptions('agreements-ui-contract')

    // Configure the application
    config.set('port', crypto.randomInt(30001, 65535))
    config.set('mongoUri', mongoOverrides.mongoUrl)
    config.set('files.s3.bucket', 'mockBucket')
    config.set('files.s3.region', 'mockRegion')
    config.set('featureFlags.seedDb', true)
    config.set('featureFlags.isPaymentHubEnabled', false)

    const sbi = 'mock-sbi'

    // Mock JWT auth functions to return valid authorization by default
    vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
      valid: true,
      source: 'defra',
      sbi
    })

    const { payment } = agreements[1].answers
    fetchWithTimeout.mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'application/json'
      },
      json: vi.fn().mockResolvedValue({ payment })
    })

    // Create and start the server
    server = await createServer({
      disableSQS: true,
      ...mongoOverrides
    })
    await server.start()
    await seedDatabase(console, [
      { ...agreements[1], identifiers: { ...agreements[1].identifiers, sbi } }
    ])
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }
  })

  it('should validate the expectations of the UI', async () => {
    const pactOpts = {
      provider: 'farming-grants-agreements-api',
      ...(process.env.CI
        ? {
            consumerVersionSelectors: [
              {
                consumer: 'farming-grants-agreements-ui',
                latest: true
              }
            ],
            publishVerificationResult:
              process.env.PACT_PUBLISH_VERIFICATION === 'true',
            providerVersion: process.env.SERVICE_VERSION ?? '1.0.0',
            failIfNoPactsFound: false
          }
        : {
            logLevel: 'debug',
            // Hard coded path for local testing
            pactUrls: getJsonPacts(localPactDir)
          }),
      providerBaseUrl: `http://localhost:${config.get('port')}`, // server.info.uri,
      requestFilter: (req, res, next) => {
        // Disable Pact setup calls, as we setup the server in the before steps
        req.url = `/${req.url.replace('_pactSetup', '')}`
        next()
      },
      stateHandlers: {
        'A customer has an accepted agreement offer': async () => {
          await acceptOffer(
            agreements[1].agreementNumber,
            agreements[1].answers
          )
        }
      }
    }

    const verify = await new Verifier(pactOpts).verifyProvider()
    expect(verify).toBeTruthy()

    return verify
  })
})
