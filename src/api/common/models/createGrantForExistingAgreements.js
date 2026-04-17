import agreementsModel from './agreements.js'
import grantModel from './grant.js'
import versionsModel from './versions.js'
import Boom from '@hapi/boom'

export const createGrantForExistingAgreements = async (logger) => {
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
      // const grantNumber = `G-${agreement.agreementNumber}`
      const agreementVersion = await versionsModel
        .findOne({ agreement: agreement._id })
        .sort({ createdAt: -1, _id: -1 })
        .lean()
        .catch((err) => {
          throw Boom.internal(err)
        })

      const defaultGrant = {
        code: agreementVersion.code,
        name: agreementVersion.scheme,
        agreementNumber: agreement.agreementNumber,
        clientRef: agreement.clientRef,
        sbi: agreement.sbi,
        frn: agreement.frn,
        claimId: agreementVersion.claimId
      }

      const createdGrant = await grantModel.create(defaultGrant)

      await versionsModel.updateMany(
        { _id: { $in: agreement.versions } },
        { $set: { grantModel: createdGrant._id, scheme: createdGrant.name } }
      )

      await agreementsModel.updateOne(
        { _id: agreement._id },
        { $push: { grants: createdGrant._id } }
      )

      logger.info(
        `Created default grant ${agreementVersion.scheme} for agreement ${agreement.agreementNumber}`
      )
    }
  } catch (err) {
    logger.error(err, 'Error during migration of existing agreements to grants')
    throw err
  }
}
