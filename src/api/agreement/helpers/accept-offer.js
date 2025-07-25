import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

/**
 * Get agreement data for rendering templates
 * @returns {object} The agreement data
 * @param {string} agreementId - The agreement ID to fetch
 * @returns {Promise<Agreement>} The agreement data
 */
async function acceptOffer(agreementId) {
  const agreement = await agreementsModel
    .updateOne(
      {
        agreementNumber: agreementId
      },
      {
        $set: {
          status: 'accepted',
          signatureDate: new Date().toISOString()
        }
      }
    )
    .catch((error) => {
      throw Boom.internal(error)
    })

  if (!agreement) {
    throw Boom.notFound(`Offer not found with ID ${agreementId}`)
  }

  return agreement
}

/**
 * Get the first payment date for a given agreement start date
 * The first quarterly payment date is always 3 calendar months + 5 days after the agreement start date
 * @param {string} agreementStartDate - The date to get the next quarterly date for
 * @returns {string} The next quarterly date in 'Month Year' format
 */
function getFirstPaymentDate(agreementStartDate) {
  const nextPaymentDate = new Date(agreementStartDate)
  nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 3)
  nextPaymentDate.setDate(nextPaymentDate.getDate() + 5)

  return nextPaymentDate.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric'
  })
}

export { acceptOffer, getFirstPaymentDate }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
