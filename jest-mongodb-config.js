export default {
  mongodbMemoryServerOptions: {
    binary: {
      skipMD5: true
    },
    instance: {
      dbName: 'farming-grants-agreements-api'
    }
  },
  mongoURLEnvName: 'MONGO_URI',
  useSharedDBForAllJestWorkers: false
}
