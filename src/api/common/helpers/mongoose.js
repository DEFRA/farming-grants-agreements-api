import mongoose from 'mongoose'

import { config } from '~/src/config/index.js'
import { seedDatabase } from './seed-database.js'

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
     * @param {{mongoUrl?: string, databaseName?: string}} [options]
     * @returns {void}
     */
    register: async function (server, options = {}) {
      server.logger.info('Setting up Mongoose')

      const mongoUrl = options.mongoUrl ?? config.get('mongoUri')
      const databaseName = options.databaseName ?? config.get('mongoDatabase')

      await mongoose.connect(mongoUrl, {
        dbName: databaseName
      })

      server.logger.info('Mongoose connected to MongoDB')

      server.decorate('server', 'mongooseDb', mongoose.connection)

      // Seed the database if required
      if (config.get('featureFlags.seedDb') === true) {
        server.logger.warn(
          'featureFlags.seedDb is enabled. This should not be enabled in production.'
        )

        seedDatabase(server.logger).catch((err) => {
          server.logger.error(err, 'Error seeding database failed:')
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      server.events.on('stop', async () => {
        server.logger.info('Closing Mongoose client')
        await mongoose.disconnect()
      })
    }
  }
}

/**
 * To be mixed in with Request|Server to provide the db decorator
 * @typedef {{connection: import('mongoose').connection }} MongoosePlugin
 */
