import * as mongoose from 'mongoose'
import { config } from '~/src/config/index.js'
import { pino } from 'pino'
import { loggerOptions } from '~/src/api/common/helpers/logging/logger-options.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'
import models from '~/src/api/common/models/index.js'

const logger = pino(loggerOptions, pino.destination())

const mongoUri = config.get('mongoUri')
const mongoDatabase = config.get('mongoDatabase')

await mongoose.connect(mongoUri, {
  dbName: mongoDatabase,
  authSource: 'admin'
})
logger.info(`Mongoose connected`)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
for (const [name, model] of Object.entries(models)) {
  try {
    await model.db.dropCollection(model.collection.name)
    logger.info(`Dropped collection '${model.collection.name}'`)

    await model.insertMany(sampleData[name])
    logger.info(
      `Successfully inserted ${sampleData[name].length} documents into the '${model.collection.name}' collection`
    )
  } catch (e) {
    logger.error(e)
  }
}

await mongoose.disconnect()
logger.info(`Mongoose disconnected`)
