// MongoDB memory server setup for Vitest
// Based on @shelf/jest-mongodb configuration
import { MongoMemoryReplSet } from 'mongodb-memory-server'

let mongoServer

export async function setup() {
  mongoServer = await MongoMemoryReplSet.create({
    binary: {
      skipMD5: true
    },
    replSet: {
      count: 3,
      storageEngine: 'wiredTiger',
      dbName: 'farming-grants-agreements-api'
    }
  })

  const uri = mongoServer.getUri()
  process.env.MONGO_URI = uri
  global.__MONGO_URI__ = uri
}

export async function teardown() {
  if (mongoServer) {
    await mongoServer.stop()
  }
}
