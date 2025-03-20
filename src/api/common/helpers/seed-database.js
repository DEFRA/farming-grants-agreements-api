import models from '~/src/api/common/models/index.js'
import data from '~/src/api/common/helpers/sample-data/index.js'

export async function seedDatabase(logger) {
  for (const [name, model] of Object.entries(models)) {
    try {
      if (await model.db.collection(name).exists()) {
        await model.db.dropCollection(name)
        logger.info(`Dropped collection '${name}'`)
      }

      await model.insertMany(data[name])
      logger.info(
        `Successfully inserted ${data[name].length} documents into the '${name}' collection`
      )
    } catch (e) {
      logger.error(e)
    }
  }
}
