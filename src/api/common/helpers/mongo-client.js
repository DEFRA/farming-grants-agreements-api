import { MongoClient } from 'mongodb'
import tls from 'node:tls'
import { config } from '#~/config/index.js'

// eslint-disable-next-line import/no-unused-modules
export const getReadPreference = (env) => {
  return env === 'production' ? 'secondary' : 'primary'
}

const mongoUri = config.get('mongoUri')

export const mongoClient = new MongoClient(mongoUri, {
  retryWrites: false,
  readPreference: getReadPreference(process.env.NODE_ENV),
  secureContext: tls.createSecureContext()
})

export const db = mongoClient.db(config.get('mongoDatabase'))
