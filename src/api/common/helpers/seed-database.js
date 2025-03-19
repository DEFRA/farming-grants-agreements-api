import models from '~/src/api/common/models/index.js'
import data from '~/src/api/common/helpers/sample-data/index.js'

export async function seedDatabase(db, logger) {
  if (process.env.NODE_ENV === 'production' || process.env.JEST_WORKER_ID) {
    return
  }

  const collections = await db.listCollections().toArray()
  if (collections.length > 0) {
    logger.info('Database already seeded, skipping')
    return
  }

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
