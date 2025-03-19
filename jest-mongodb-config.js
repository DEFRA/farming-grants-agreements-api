export default {
  mongodbMemoryServerOptions: {
    binary: {
      skipMD5: true
    },
    instance: {
      dbName: 'farming-grants-agreements-api',
      storageEngine: 'wiredTiger'
    }
  },
  mongoURLEnvName: 'MONGO_URI',
  useSharedDBForAllJestWorkers: true
}
