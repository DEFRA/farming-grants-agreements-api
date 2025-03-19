import { MongoClient } from 'mongodb'
import { config } from '~/src/config/index.js'
import { pino } from 'pino'
import { loggerOptions } from '~/src/api/common/helpers/logging/logger-options.js'
import data from './data/index.js'

const logger = pino(loggerOptions, pino.destination())

async function seedDatabase() {
  if (
    process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test'
  ) {
    logger.error(
      'Database seeding is only allowed in development or test environments'
    )
    return
  }

  const client = new MongoClient(
    `${config.get('mongoUri')}${config.get('mongoDatabase')}`
  )

  try {
    await client.connect()
    logger.info('Connected to MongoDB')

    const db = client.db()

    // Process each collection in the data
    for (const [collectionName, documents] of Object.entries(data)) {
      try {
        // Drop the existing collection
        await db.collection(collectionName).drop()
        logger.info(`Dropped collection '${collectionName}'`)

        // Insert the new documents
        if (documents.length > 0) {
          await db.collection(collectionName).insertMany(documents)
          logger.info(
            `Successfully inserted ${documents.length} documents into the '${collectionName}' collection`
          )
        } else {
          logger.info(
            `No documents to insert for collection '${collectionName}'`
          )
        }
      } catch (e) {
        logger.error(`Error processing collection ${collectionName}:`, e)
      }
    }
  } catch (e) {
    logger.error('Failed to connect to MongoDB:', e)
    throw e
  } finally {
    await client.close()
    logger.info('Disconnected from MongoDB')
  }
}

// Run the seeding process
seedDatabase().catch((error) => {
  logger.error('Seeding failed:', error)
})
