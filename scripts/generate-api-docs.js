/* eslint-disable no-console, n/no-process-exit */
import { createServer } from '../src/api/index.js'
import { asyncApiSpec } from '../src/api/common/asyncapi-spec.js'
import fs from 'node:fs'
import path from 'node:path'

console.log('Generating API documentation...')

try {
  // Generate OpenAPI spec (docsOnly skips MongoDB, SQS, and other runtime plugins)
  const server = await createServer({ docsOnly: true })
  await server.initialize()

  const response = await server.inject({
    method: 'GET',
    url: '/docs/openapi.json'
  })
  const openApiSpec = JSON.parse(response.payload)

  const openApiPath = path.resolve(process.cwd(), 'docs/openapi.json')
  fs.writeFileSync(openApiPath, JSON.stringify(openApiSpec, null, 2))
  console.log(`OpenAPI spec written to ${openApiPath}`)

  // Write AsyncAPI spec
  const asyncApiPath = path.resolve(process.cwd(), 'docs/asyncapi.json')
  fs.writeFileSync(asyncApiPath, JSON.stringify(asyncApiSpec, null, 2))
  console.log(`AsyncAPI spec written to ${asyncApiPath}`)

  console.log('API documentation generated successfully.')
} catch (error) {
  console.error('Failed to generate API documentation:', error)
  process.exit(1)
}
