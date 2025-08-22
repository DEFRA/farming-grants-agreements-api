import mongoose from 'mongoose'
import models from '~/src/api/common/models/index.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'
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
        .catch((error) =>
          logger.warn(`Error dropping collection '${name}': ${error.message}`)
        )

      logger.info(`Dropped collection '${name}'`)

      const tableData = sampleData[name]
      if (tableData?.length && name === 'agreements') {
        for (const row of tableData) {
          await publishEvent(
            {
              topicArn:
                'arn:aws:sns:eu-west-2:000000000000:grant_application_approved',
              type: 'io.onsite.agreement.application.approved',
              time: new Date().toISOString(),
              data: row
            },
            logger
          )
        }

        logger.info(
          `Successfully inserted ${tableData.length} documents into the '${name}' collection`
        )
      }
    } catch (e) {
      logger.error(e)
    }
  }
}
