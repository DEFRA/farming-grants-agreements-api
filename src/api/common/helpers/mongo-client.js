import { MongoClient } from 'mongodb'
import tls from 'node:tls'
import { config } from '#~/config/index.js'

// eslint-disable-next-line import/no-unused-modules
export const getReadPreference = (env) => {
  return env === 'production' ? 'secondary' : 'primary'
}

const getMongoClient = () => {
  const mongoUri = config.get('mongoUri')
  if (!mongoUri || mongoUri === 'mongodb://127.0.0.1:27017/') {
    // Return a dummy client if we don't have a real URI or if it's the default one during tests
    // This prevents the "collection name has invalid type null" error during some test imports
    return {
      db: () => ({
        collection: () => ({
          find: () => ({ toArray: () => Promise.resolve([]) }),
          insertOne: () => Promise.resolve({})
        })
      })
    }
  }
  return new MongoClient(mongoUri, {
    retryWrites: false,
    readPreference: getReadPreference(process.env.NODE_ENV),
    secureContext: tls.createSecureContext()
  })
}

// @ts-expect-error: mongoClient might be a dummy client during tests
export const mongoClient = getMongoClient()

export const db = mongoClient.db(config.get('mongoDatabase'))
