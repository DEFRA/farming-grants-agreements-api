import { vi } from 'vitest'
import crypto from 'node:crypto'
import path from 'node:path'

import { Verifier } from '@pact-foundation/pact'

import { createServer } from '#~/api/index.js'
import { config } from '#~/config/index.js'
import * as jwtAuth from '#~/api/common/helpers/jwt-auth.js'
import { seedDatabase } from '#~/api/common/helpers/seed-database.js'
import agreements from '#~/api/common/helpers/sample-data/agreements.js'
import { fetchWithTimeout } from '#~/api/common/helpers/fetch.js'
import { acceptOffer } from '#~/api/agreement/helpers/accept-offer.js'
import { getJsonPacts } from '#~/contracts/test-helpers/pact.js'
import { buildIsolatedMongoOptions } from '#~/contracts/test-helpers/mongo.js'

vi.unmock('mongoose')

vi.mock('#~/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(true)
}))

vi.mock('#~/api/common/helpers/fetch.js', () => ({
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
    config.set('featureFlags.seedDb', false)
    config.set('featureFlags.wmpMigrationDiagnosis', false)

    const sbi = '107593059'

    // Mock JWT auth functions to return valid authorization by default
    vi.spyOn(jwtAuth, 'validateJwtAuthentication').mockReturnValue({
      valid: true,
      source: 'defra',
      sbi
    })

    const { payment } = agreements[1].answers
    const calculateResponse = {
      message: 'success',
      payment: {
        ...payment,
        agreementStartDate: '2025-12-01',
        agreementEndDate: '2028-12-01',
        agreementTotalPence: 242298,
        annualTotalPence: 80766,
        payments: [
          {
            paymentDate: '2026-03-05',
            totalPaymentPence: 20197,
            lineItems: [{ agreementLevelItemId: 1, paymentPence: 20197 }]
          }
        ]
      }
    }

    fetchWithTimeout.mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/v2/payments/calculate')) {
        return Promise.resolve({
          ok: true,
          headers: {
            get: () => 'application/json'
          },
          json: vi.fn().mockResolvedValue(calculateResponse)
        })
      }
      return Promise.resolve({
        ok: true,
        headers: {
          get: () => 'application/json'
        },
        json: vi.fn().mockResolvedValue({ payment })
      })
    })

    // Create and start the server
    server = await createServer({
      disableSQS: true,
      ...mongoOverrides
    })
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
          vi.mocked(jwtAuth.validateJwtAuthentication).mockReturnValue({
            valid: true,
            source: 'defra',
            sbi: '107593059'
          })
          await acceptOffer(
            agreements[1].agreementNumber,
            agreements[1].answers,
            console
          )
        },
        'A customer has a WMP agreement offer': () => {
          vi.mocked(jwtAuth.validateJwtAuthentication).mockReturnValue({
            valid: true,
            source: 'defra',
            sbi: '107593059'
          })
          return Promise.resolve()
        },
        'A customer has an agreement offer': () => {
          vi.mocked(jwtAuth.validateJwtAuthentication).mockReturnValue({
            valid: true,
            source: 'defra',
            sbi: '107593059'
          })
          return Promise.resolve()
        },
        'A customer has confirmed checkbox and is ready to accept': () => {
          vi.mocked(jwtAuth.validateJwtAuthentication).mockReturnValue({
            valid: true,
            source: 'defra',
            sbi: '107593059'
          })
          return Promise.resolve()
        },
        'A customer has an offer that has been withdrawn': () => {
          vi.mocked(jwtAuth.validateJwtAuthentication).mockReturnValue({
            valid: true,
            source: 'defra',
            sbi: '107593059'
          })
          return Promise.resolve()
        }
      }
    }

    const verify = await new Verifier(pactOpts).verifyProvider()
    expect(verify).toBeTruthy()

    return verify
  }, 30000)
})
