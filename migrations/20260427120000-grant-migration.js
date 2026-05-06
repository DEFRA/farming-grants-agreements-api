import { createLogger } from '#~/api/common/helpers/logging/logger.js'

const logger = createLogger()

export const up = async (db) => {
  logger.warn(
    'Running migration: ' +
      'This is to create default grant for existing agreement in production to work with new database restructuring.'
  )

  try {
    const agreements = await db
      .collection('agreements')
      .find({
        $or: [
          { grants: { $exists: false } },
          { grants: { $size: 0 } },
          { grants: null }
        ]
      })
      .toArray()

    logger.info(`Found ${agreements.length} agreements without grants.`)

    for (const agreement of agreements) {
      // Check if a grant already exists for this agreement
      const existingGrant = await db
        .collection('grants')
        .findOne({ agreementNumber: agreement.agreementNumber })

      let grantId
      if (existingGrant) {
        grantId = existingGrant._id
        logger.info(
          `Grant already exists for agreement ${agreement.agreementNumber}, reusing it.`
        )
      } else {
        // Get the latest version for this agreement
        const agreementVersion = await db
          .collection('versions')
          .find({ agreement: agreement._id })
          .sort({ createdAt: -1, _id: -1 })
          .limit(1)
          .toArray()

        if (agreementVersion.length === 0) {
          logger.warn(
            `No versions found for agreement ${agreement.agreementNumber}, skipping.`
          )
          continue
        }

        const version = agreementVersion[0]

        // Create the default grant document
        const defaultGrant = {
          code: version.code,
          name: version.scheme,
          agreementNumber: agreement.agreementNumber,
          clientRef: agreement.clientRef,
          sbi: agreement.sbi,
          frn: agreement.frn,
          claimId: version.claimId,
          versions: agreement.versions
        }

        // Insert the grant
        const grantResult = await db
          .collection('grants')
          .insertOne(defaultGrant)
        grantId = grantResult.insertedId

        logger.info(
          `Created default grant ${version.scheme} for agreement ${agreement.agreementNumber}`
        )
      }

      // Update all versions for this agreement
      await db
        .collection('versions')
        .updateMany(
          { _id: { $in: agreement.versions } },
          { $set: { grant: grantId } }
        )

      // Update the agreement to include the grant (using $addToSet for idempotency)
      await db
        .collection('agreements')
        .updateOne({ _id: agreement._id }, { $addToSet: { grants: grantId } })

      logger.info(`Linked grant to agreement ${agreement.agreementNumber}`)
    }
  } catch (err) {
    logger.error('Error during migration of existing agreement to grants:', err)
    throw err
  }
}
