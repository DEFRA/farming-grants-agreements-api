import mongoose from 'mongoose'
import models from '~/src/api/common/models/index.js'
import data from '~/src/api/common/helpers/sample-data/index.js'
import { publishEvent } from '~/src/api/common/helpers/sns-publisher.js'

export async function seedDatabase(logger) {
  while (mongoose.connection.readyState !== mongoose.STATES.connected) {
    logger.info('Waiting for mongoose to connect...')
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  for (const [name, model] of Object.entries(models)) {
    try {
      await model.db
        .dropCollection(name)
        .catch(() => logger.warn(`Collection '${name}' does not exist`))

      logger.info(`Dropped collection '${name}'`)

      const sampleData = data[name]
      if (sampleData?.length) {
        sampleData.forEach(async (data) => {
          await publishEvent(
            {
              topicArn:
                'arn:aws:sns:eu-west-2:000000000000:grant_application_approved',
              type: 'io.onsite.agreement.application.approved',
              time: new Date().toISOString(),
              data
            },
            logger
          )
        })

        logger.info(
          `Successfully inserted ${sampleData.length} documents into the '${name}' collection`
        )
      }
    } catch (e) {
      logger.error(e)
    }
  }
}
