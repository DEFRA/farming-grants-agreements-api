import mongoose from 'mongoose'
import { seedDatabase } from '~/src/api/common/helpers/seed-database.js'
import { config } from '~/src/config/index.js'

/**
 * @satisfies { import('@hapi/hapi').ServerRegisterPluginObject<*> }
 */
export const mongooseDb = {
  plugin: {
    name: 'mongoose',
    version: '1.0.0',
    /**
     *
     * @param { import('@hapi/hapi').Server } server
     * @param {{mongoUrl: string, databaseName: string}} options
     * @returns {void}
     */
    register: async function (server, options) {
      server.logger.info('Setting up mongoose')

      await mongoose.connect(options.mongoUrl, {
        dbName: options.databaseName
      })

      server.decorate('server', 'mongooseDb', mongoose.connection)

      // Seed the database if not in production or invoked through testing
      if (
        process.env.NODE_ENV !== 'production' &&
        process.env.JEST_WORKER_ID === undefined
      ) {
        await seedDatabase(mongoose.connection.db, server.logger)
      }

      server.events.on('stop', () => {
        server.logger.info('Closing Mongoose client')
        mongoose.disconnect().catch((error) => {
          server.logger.error('Error disconnecting from MongoDB', error)
        })
      })
    }
  },
  options: {
    mongoUrl: config.get('mongoUri'),
    databaseName: config.get('mongoDatabase')
  }
}

/**
 * To be mixed in with Request|Server to provide the db decorator
 * @typedef {{db: import('mongodb').Db, locker: import('mongo-locks').LockManager }} MongoDBPlugin
 */
