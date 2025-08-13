import mongoose from 'mongoose'
import models from '~/src/api/common/models/index.js'
import data from '~/src/api/common/helpers/sample-data/index.js'
import { publishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { config } from '~/src/config/index.js'

const publishEvents = async (sampleData, logger) => {
  for (const item of sampleData) {
    // Publish event to SNS
    await publishEvent(
      {
        topicArn: config.get('aws.sns.topic.offerCreated.arn'),
        type: config.get('aws.sns.topic.offerCreated.type'),
        time: new Date().toISOString(),
        data: {
          correlationId: item?.correlationId,
          clientRef: item?.clientRef,
          offerId: item?.agreementNumber,
          frn: item?.frn,
          sbi: item?.sbi
        }
      },
      logger
    )
  }
}

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
      if (sampleData) {
        await model.insertMany(sampleData).catch((e) => {
          logger.error(e)
        })

        logger.info(
          `Successfully inserted ${sampleData.length} documents into the '${name}' collection`
        )

        await publishEvents(sampleData, logger)
      }
    } catch (e) {
      logger.error(e)
    }
  }
}
