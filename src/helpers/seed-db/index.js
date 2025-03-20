import * as mongoose from 'mongoose'
import { config } from '~/src/config/index.js'
import { pino } from 'pino'
import { loggerOptions } from '~/src/api/common/helpers/logging/logger-options.js'
import data from './data/index.js'
import models from '~/src/api/common/models/index.js'

const logger = pino(loggerOptions, pino.destination())

const seedDatabase = async () => {
  if (
    process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test'
  ) {
    logger.warn('Seed script can only be run in development or test mode')
    return
  }

  try {
    await mongoose.connect(
      `${config.get('mongoUri')}${config.get('mongoDatabase')}`
    )
    logger.info('Mongoose connected')

    for (const [name, model] of Object.entries(models)) {
      try {
        await model.db.dropCollection(name)
        logger.info(`Dropped collection '${name}'`)

        await model.insertMany(data[name])
        logger.info(
          `Successfully inserted ${data[name].length} documents into the '${name}' collection`
        )
      } catch (error) {
        logger.error(`Error processing collection '${name}': ${error.message}`)
        throw error
      }
    }
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`)
  } finally {
    try {
      await mongoose.disconnect()
      logger.info('Mongoose disconnected')
    } catch (disconnectError) {
      logger.error(
        `Error disconnecting from MongoDB: ${disconnectError.message}`
      )
    }
  }
}

await seedDatabase()
