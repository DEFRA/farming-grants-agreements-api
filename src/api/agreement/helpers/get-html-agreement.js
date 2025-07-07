import Boom from '@hapi/boom'
import { getAgreementData } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { renderTemplate } from '~/src/api/agreement/helpers/nunjucks-renderer.js'

const dateOptions = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric'
}

const formatCurrency = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'number') {
    return value.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP'
    })
  }
  return value.toString().replace(/[^0-9.-]+/g, '')
}

/**
 * Creates a table of land data for the agreement
 * @param {object} agreementData - The agreement data object
 * @returns Object containing headings and data for the land table
 */
const getAgreementLand = (agreementData) => {
  return {
    headings: [
      { text: 'Parcel' },
      { text: 'Parcel name' },
      { text: 'Total parcel area (hectares)' }
    ],
    data: agreementData.parcels.map((parcel) => [
      { text: parcel.parcelNumber },
      { text: parcel.parcelName },
      { text: parcel.totalArea }
    ])
  }
}

/**
 * Creates a summary of actions for the agreement
 * @param {object} agreementData - The agreement data object
 * @returns Object containing headings and data for the summary of actions table
 */
const getSummaryOfActions = (agreementData) => {
  return {
    headings: [
      { text: 'Parcel number' },
      { text: 'Code' },
      { text: 'Description' },
      { text: 'Total parcel area (hectares)' },
      { text: 'Area (hectares) / Length (meters) / Unit' },
      { text: 'Start date' },
      { text: 'End date' }
    ],
    data: agreementData.parcels.flatMap((parcel) =>
      parcel.activities.map((activity) => [
        { text: parcel.parcelNumber },
        { text: activity.code },
        { text: activity.description },
        { text: parcel.totalArea },
        { text: activity.area },
        {
          text: activity.startDate.toLocaleDateString('en-GB', dateOptions)
        },
        {
          text: activity.endDate.toLocaleDateString('en-GB', dateOptions)
        }
      ])
    )
  }
}

/**
 * Creates a table of actions for the agreement
 * @param {object} agreementData - The agreement data object
 * @returns Object containing headings and data for the agreement level actions table
 */
const getAgreementLevelActions = (agreementData) => {
  return {
    headings: [
      { text: 'Action code' },
      { text: 'Title' },
      { text: 'Action End date' },
      { text: 'Action Start date' },
      { text: 'Action duration' }
    ],
    data: agreementData.actions.map((action) => [
      { text: action.code },
      { text: action.title },
      { text: action.endDate.toLocaleDateString('en-GB', dateOptions) },
      { text: action.startDate.toLocaleDateString('en-GB', dateOptions) },
      { text: action.duration }
    ])
  }
}

/**
 * Creates a summary of payments for the agreement
 * @param {object} agreementData - The agreement data object
 * @returns Object containing headings and data for the summary of payments table
 */
const getSummaryOfPayments = (agreementData) => {
  return {
    headings: [
      { text: 'Code' },
      { text: 'Description' },
      { text: 'Total area (hectares) / length (meters) / unit' },
      { text: 'Payment rate' },
      { text: 'Total annual agreement grant payment' }
    ],
    data: agreementData.payments.activities.map((payment) => [
      { text: payment.code },
      { text: payment.description },
      { text: payment.measurement },
      { text: payment.paymentRate },
      { text: formatCurrency(payment.annualPayment) }
    ])
  }
}

/**
 * Creates a table of annual payment schedule for the agreement
 * @param {object} agreementData - The agreement data object
 * @returns Object containing headings and data for the annual payment schedule table
 */
const getAnnualPaymentSchedule = (agreementData) => {
  return {
    headings: [
      { text: 'Code' },
      { text: 'Year 1' },
      { text: 'Year 2' },
      { text: 'Year 3' },
      { text: 'Total agreement grant payment' }
    ],
    data: [
      ...agreementData.payments.yearlyBreakdown.details.map((detail) => [
        { text: detail.code },
        { text: formatCurrency(detail.year1) },
        { text: formatCurrency(detail.year2) },
        { text: formatCurrency(detail.year3) },
        { text: formatCurrency(detail.totalPayment) }
      ]),
      [
        { text: 'Total' },
        {
          text: formatCurrency(
            agreementData.payments.yearlyBreakdown.annualTotals.year1
          )
        },
        {
          text: formatCurrency(
            agreementData.payments.yearlyBreakdown.annualTotals.year2
          )
        },
        {
          text: formatCurrency(
            agreementData.payments.yearlyBreakdown.annualTotals.year3
          )
        },
        {
          text: formatCurrency(
            agreementData.payments.yearlyBreakdown.totalAgreementPayment
          )
        }
      ]
    ]
  }
}

/**
 * Renders a Nunjucks template with agreement data
 * @param {string} agreementId - The agreement ID to fetch
 * @param {object} [data] - The agreement data object (optional)
 */
const getHTMLAgreementDocument = async (agreementId, data) => {
  if (agreementId == null) {
    throw Boom.badRequest('Agreement ID is required')
  }

  const agreementData =
    data || (await getAgreementData({ agreementNumber: agreementId }))

  if (!agreementData) {
    throw Boom.notFound(`Agreement not found ${agreementId}`)
  }

  agreementData.agreementLand = getAgreementLand(agreementData)
  agreementData.summaryOfActions = getSummaryOfActions(agreementData)
  agreementData.agreementLevelActions = getAgreementLevelActions(agreementData)
  agreementData.summaryOfPayments = getSummaryOfPayments(agreementData)
  agreementData.annualPaymentSchedule = getAnnualPaymentSchedule(agreementData)

  return renderTemplate('views/sfi-agreement.njk', agreementData)
}

export { getHTMLAgreementDocument }
