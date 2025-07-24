import Boom from '@hapi/boom'
import agreementsModel from '~/src/api/common/models/agreements.js'

const MONTHS_PER_QUARTER = 3

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
 * Get the next quarter for a given date
 * @param {string} dateString - The date to get the next quarter for
 * @returns {string} The next quarter
 */
function getNextQuarter(dateString) {
  const date = new Date(dateString)
  let year = date.getFullYear()
  const month = date.getMonth()

  let quarter = Math.floor(month / MONTHS_PER_QUARTER) + 1

  if (quarter === 4) {
    quarter = 1
    year += 1
  } else {
    quarter += 1
  }

  const startMonth = (quarter - 1) * MONTHS_PER_QUARTER
  const start = new Date(year, startMonth, 1)

  return start.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric'
  })
}

export { acceptOffer, getNextQuarter }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
