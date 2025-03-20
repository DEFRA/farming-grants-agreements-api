import * as mongoose from 'mongoose'
import { config } from '~/src/config/index.js'
import { pino } from 'pino'
import { loggerOptions } from '~/src/api/common/helpers/logging/logger-options.js'
import data from './data/index.js'
import models from '~/src/api/common/models/index.js'

const logger = pino(loggerOptions, pino.destination())

if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
  logger.warn('Seed script can only be run in development or test mode')
} else {
  await mongoose
    .connect(`${config.get('mongoUri')}${config.get('mongoDatabase')}`)
    .catch((error) => {
      logger.error(`Error connecting to MongoDB: ${error.message}`)
      throw error
    })

  logger.info(`Mongoose connected`)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const [name, model] of Object.entries(models)) {
    try {
      await model.db.dropCollection(model.collection.name)
      logger.info(`Dropped collection '${model.collection.name}'`)

      await model.insertMany(data[model.collection.name])
      logger.info(
        `Successfully inserted ${data[model.collection.name].length} documents into the '${model.collection.name}' collection`
      )
    } catch (error) {
      logger.error(error)
      throw error
    }
  }

  await mongoose.disconnect()
  logger.info(`Mongoose disconnected`)
}
