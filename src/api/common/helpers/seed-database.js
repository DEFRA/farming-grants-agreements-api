import models from '~/src/api/common/models/index.js'
import data from '~/src/api/common/helpers/sample-data/index.js'

export async function seedDatabase(db, logger) {
  logger.info(`Seeding database in ${process.env.NODE_ENV} environment`)

  for (const [name, model] of Object.entries(models)) {
    try {
      await model.db.dropCollection(name)
      logger.info(`Dropped collection '${name}'`)

      await model.insertMany(data[name])
      logger.info(
        `Successfully inserted ${data[name].length} documents into the '${name}' collection`
      )
    } catch (e) {
      logger.error(e)
    }
  }
}
