import agreementsModel from './agreements.js'
import grantsModel from './grants.js'
import versionsModel from './versions.js'

export const creatGrantForExistingAgreements = async (logger) => {
  logger.warn(
    'featureFlags.migrationForCS is enabled. ' +
      ' This is to create default grant for existing agreement in production to work with new database restructuring.'
  )

  try {
    const agreements = await agreementsModel.find({
      $or: [
        { grants: { $exists: false } },
        { grants: { $size: 0 } },
        { grants: null }
      ]
    })

    logger.info(`Found ${agreements.length} agreements without grants.`)

    for (const agreement of agreements) {
      const grantNumber = `G-${agreement.agreementNumber}`
      const defaultGrant = {
        grantNumber,
        name: 'Default Grant CS',
        county: 'UK',
        agreementNumber: agreement.agreementNumber,
        sbi: agreement.sbi,
        frn: agreement.frn,
        versions: agreement.versions
      }

      const createdGrant = await grantsModel.create(defaultGrant)

      await versionsModel.updateMany(
        { _id: { $in: agreement.versions } },
        { $set: { grant: createdGrant._id } }
      )

      await agreementsModel.updateOne(
        { _id: agreement._id },
        { $push: { grants: createdGrant._id } }
      )

      logger.info(
        `Created default grant ${grantNumber} for agreement ${agreement.agreementNumber}`
      )
    }
  } catch (err) {
    logger.error(err, 'Error during migration of existing agreements to grants')
    throw err
  }
}
