import { MongoClient } from 'mongodb'
import tls from 'node:tls'
import { config as migrateMongoConfig } from 'migrate-mongo'
import migrateConfig from '../../../../migrate-mongo-config.js'
import { config } from '#~/config/index.js'

// Explicitly set migrate-mongo config globally when mongo-client is loaded
// This ensures programmatic migrations work without explicit config injection in plugins
migrateMongoConfig.set(migrateConfig)

// eslint-disable-next-line import/no-unused-modules
export const getReadPreference = (env) => {
  return env === 'production' ? 'secondary' : 'primary'
}

const getMongoClient = () => {
  const mongoUri = config.get('mongoUri')
  const dbName = config.get('mongoDatabase')

  // If we are in a context where we want a dummy client (e.g., generating docs without a real DB)
  // We check if it is explicitly requested to use a dummy or if it is a safe fallback
  const isDev = config.get('env') === 'development'
  const isTest = config.get('env') === 'test'
  if (
    !mongoUri ||
    (mongoUri === 'mongodb://127.0.0.1:27017/' &&
      !process.env.MONGO_URI &&
      !isDev &&
      !isTest)
  ) {
    // Return a dummy client if we don't have a real URI or if it's the default one during tests
    // This prevents the "collection name has invalid type null" error during some test imports
    const dummyCollection = () => ({
      find: () => ({ toArray: () => Promise.resolve([]) }),
      insertOne: () => Promise.resolve({})
    })
    const dummyDb = () => ({
      collection: dummyCollection
    })
    return {
      db: dummyDb
    }
  }

  // Ensure the URI includes the DB name for the native driver if not present
  const fullUri = mongoUri.endsWith('/') ? `${mongoUri}${dbName}` : mongoUri

  return new MongoClient(fullUri, {
    retryWrites: false,
    readPreference: getReadPreference(process.env.NODE_ENV),
    secureContext: tls.createSecureContext()
  })
}

// @ts-expect-error: mongoClient might be a dummy client during tests
export const mongoClient = getMongoClient()

export const db = mongoClient.db(config.get('mongoDatabase'))
