export const mongodbMemoryServerOptions = {
  binary: {
    skipMD5: true
  },
  autoStart: false,
  instance: {
    dbName: 'farming-grants-agreements-api'
  },
  replSet: {
    count: 3,
    storageEngine: 'wiredTiger'
  }
}
export const mongoURLEnvName = 'MONGO_URI'
export const useSharedDBForAllJestWorkers = false
