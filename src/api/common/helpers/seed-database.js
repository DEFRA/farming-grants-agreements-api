import mongoose from 'mongoose'
import models from '~/src/api/common/models/index.js'
import sampleData from '~/src/api/common/helpers/sample-data/index.js'
import { publishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { handleCreateAgreementEvent } from './sqs-message-processor/create-agreement.js'

async function publishSampleAgreementEvents(tableData, logger) {
  for (const row of tableData) {
    const event = {
      topicArn:
        'arn:aws:sns:eu-west-2:000000000000:grant_application_approved_fifo.fifo',
      type: 'cloud.defra.test.fg-gas-backend.agreement.create',
      time: new Date().toISOString(),
      data: row
    }
    if (process.env.NODE_ENV === 'test') {
      // Contract tests need to publish directly (as they don't have access to SNS)
      await handleCreateAgreementEvent(
        event.data.notificationMessageId,
        event,
        logger
      )
    } else {
      await publishEvent(
        event,
        logger,
        process.env.NODE_ENV === 'development'
          ? undefined
          : {
              // We're not allowed to publish application approved events on the platform
              // this mocks the SNS send/process logic for sample data
              send: async ({ input: { Message } }) => {
                const message = JSON.parse(Message)
                await handleCreateAgreementEvent(message.id, message, logger)
              }
            }
      )
    }
  }
  logger.info(
    `Successfully published ${tableData.length} 'agreements' documents`
  )
}

export async function seedDatabase(logger, tableData = sampleData.agreements) {
  while (mongoose.connection.readyState !== mongoose.STATES.connected) {
    logger.info('Waiting for mongoose to connect...')
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  logger.info('Seeding database')

  for (const [name, model] of Object.entries(models)) {
    try {
      await model.db.dropCollection(name)
      logger.info(`Dropped collection '${name}'`)
    } catch (e) {
      logger.warn(`Error dropping collection '${name}': ${e.message}`)
    }
  }

  try {
    await publishSampleAgreementEvents(tableData, logger)
  } catch (e) {
    logger.error(e)
  }
}
