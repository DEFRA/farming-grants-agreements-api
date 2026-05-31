import { createLogger } from '#~/api/common/helpers/logging/logger.js'

const logger = createLogger()

export const up = async (db) => {
  logger.warn('Running migration: Delete all backup collections.')

  const patterns = [
    /^backup_gps_grants_.*$/,
    /^backup_gps_versions_.*$/,
    /^versions_backup_.*$/,
    /^agreements_backup_.*$/
  ]

  try {
    const collections = await db.listCollections().toArray()
    const collectionsToDelete = collections
      .map((col) => col.name)
      .filter((name) => patterns.some((pattern) => pattern.test(name)))

    if (collectionsToDelete.length === 0) {
      logger.info('No backup collections found to delete.')
      return
    }

    logger.info(
      `Found ${collectionsToDelete.length} backup collections to delete: ${collectionsToDelete.join(', ')}`
    )

    for (const collectionName of collectionsToDelete) {
      logger.info(`Deleting collection: ${collectionName}`)
      await db.collection(collectionName).drop()
      logger.info(`Successfully deleted: ${collectionName}`)
    }

    logger.info(
      'Migration completed: All specified backup collections have been deleted.'
    )
  } catch (err) {
    logger.error('Error during migration of deleting backup collections:', err)
    throw err
  }
}
