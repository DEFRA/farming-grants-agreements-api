import Boom from '@hapi/boom'
import round from 'lodash/round.js'
import { getAgreementDataById } from '~/src/api/agreement/helpers/get-agreement-data.js'

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
    return (value / 100).toLocaleString('en-GB', {
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
  const parcels = new Map()
  Object.values(agreementData.payment.parcelItems).forEach(
    ({ parcelId, quantity: area }) => {
      const currentArea = parcels.has(parcelId) ? parcels.get(parcelId) : 0
      parcels.set(parcelId, Number(currentArea) + Number(area))
    }
  )

  const data = []
  for (const [key, value] of parcels) {
    data.push([{ text: key }, { text: value }])
  }

  return {
    headings: [{ text: 'Parcel' }, { text: 'Total parcel area (ha)' }],
    data
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
      { text: 'Parcel' },
      { text: 'Code' },
      { text: 'Action' },
      { text: 'Total parcel area (ha)' },
      { text: 'Start date' },
      { text: 'End date' }
    ],
    data: Object.values(agreementData.payment.parcelItems).map((parcel) => [
      { text: parcel.parcelId },
      { text: parcel.code },
      { text: parcel.description?.replace(`${parcel.code}: `, '') },
      { text: parcel.quantity },
      {
        text: new Date(
          agreementData.payment.agreementStartDate
        ).toLocaleDateString('en-GB', dateOptions)
      },
      {
        text: new Date(
          agreementData.payment.agreementEndDate
        ).toLocaleDateString('en-GB', dateOptions)
      }
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
      { text: 'Action' },
      { text: 'Total area (ha)' },
      { text: 'Payment rate' },
      { text: 'Total yearly payment' }
    ],
    data: [
      ...Object.values(agreementData.payment.parcelItems).map((payment) => [
        { text: payment.code },
        { text: payment.description },
        { text: round(payment.quantity, 4) },
        {
          text: `${formatCurrency(payment.rateInPence)} per ${payment.unit.replace(/s$/, '')}`
        },
        { text: formatCurrency(payment.annualPaymentPence) }
      ]),
      ...Object.values(agreementData.payment.agreementLevelItems).map(
        (payment) => [
          { text: payment.code },
          {
            text: `One-off payment per agreement per year for ${payment.description?.replace(`${payment.code}: `, '')}`
          },
          { text: '' },
          { text: '' },
          { text: formatCurrency(payment.annualPaymentPence) }
        ]
      )
    ].sort((a, b) => a[0].text.localeCompare(b[0].text))
  }
}

/**
 * Creates a table of annual payment schedule for the agreement
 * @param {object} agreementData - The agreement data object
 * @returns Object containing headings and data for the annual payment schedule table
 */
const getAnnualPaymentSchedule = (agreementData) => {
  const dataByCode = new Map()
  agreementData.payment.payments.forEach((payment) => {
    const year = new Date(payment.paymentDate).getFullYear()

    payment.lineItems.forEach((line) => {
      let code
      if (line.parcelItemId) {
        code = agreementData.payment.parcelItems[line.parcelItemId]?.code
      } else if (line.agreementLevelItemId) {
        code =
          agreementData.payment.agreementLevelItems[line.agreementLevelItemId]
            ?.code
      }

      if (code) {
        const years = dataByCode.has(code) ? dataByCode.get(code) : new Map()
        const currentValue = years.has(year) ? years.get(year) : 0
        years.set(year, Number(currentValue) + Number(line.paymentPence))

        // Update total for this code
        const currentTotal = years.has('total') ? years.get('total') : 0
        years.set('total', Number(currentTotal) + Number(line.paymentPence))

        dataByCode.set(code, years)
      }
    })
  })

  // Get all unique years from the data
  const allYears = new Set()
  dataByCode.forEach((years) => {
    years.forEach((value, year) => {
      if (year !== 'total') {
        allYears.add(year)
      }
    })
  })

  const sortedYears = Array.from(allYears).sort()

  // Sort dataByCode by code keys
  const sortedCodes = Array.from(dataByCode.keys()).sort()

  // Build table data
  const tableData = []
  const yearTotals = {}
  let grandTotal = 0

  // Initialize year totals
  sortedYears.forEach((year) => {
    yearTotals[year] = 0
  })

  // Add rows for each code in sorted order
  sortedCodes.forEach((code) => {
    const years = dataByCode.get(code)
    const row = [{ text: code }]

    // Add data for each year
    sortedYears.forEach((year) => {
      const yearValue = years.has(year) ? years.get(year) : 0
      row.push({ text: formatCurrency(yearValue) })
      yearTotals[year] += yearValue
    })

    // Add total for this code
    const codeTotal = years.has('total') ? years.get('total') : 0
    row.push({ text: formatCurrency(codeTotal) })
    grandTotal += codeTotal

    tableData.push(row)
  })

  // Add totals row
  const totalsRow = [{ text: 'Total' }]
  sortedYears.forEach((year) => {
    totalsRow.push({ text: formatCurrency(yearTotals[year]) })
  })
  totalsRow.push({ text: formatCurrency(grandTotal) })
  tableData.push(totalsRow)

  // Build headings
  const headings = [{ text: 'Code' }]
  sortedYears.forEach((year) => {
    headings.push({ text: year })
  })
  headings.push({ text: 'Total payment' })

  return {
    headings,
    data: tableData
  }
}

/**
 * Renders a Nunjucks template with agreement data
 * @param {string} agreementId - The agreement ID to fetch
 * @param {object} [data] - The agreement data object (optional)
 */
const getAgreement = async (agreementId, data) => {
  if (agreementId == null) {
    throw Boom.badRequest('Agreement ID is required')
  }

  const agreement = data || (await getAgreementDataById(agreementId))

  if (!agreement) {
    throw Boom.notFound(`Agreement not found ${agreementId}`)
  }

  agreement.agreementLand = getAgreementLand(agreement)
  agreement.summaryOfActions = getSummaryOfActions(agreement)
  agreement.summaryOfPayments = getSummaryOfPayments(agreement)
  agreement.annualPaymentSchedule = getAnnualPaymentSchedule(agreement)
  agreement.agreementNumber = agreementId

  return agreement
}

export { getAgreement }
