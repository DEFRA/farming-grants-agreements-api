import crypto from 'crypto'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { v4 as uuidv4 } from 'uuid'

export const generateAgreementNumber = () => {
  const minRandomNumber = 100000000
  const maxRandomNumber = 999999999
  const randomNum = crypto.randomInt(minRandomNumber, maxRandomNumber)
  return `SFI${randomNum}`
}

/**
 * Groups Parcels by their ID
 * @param {Array<object>} actionApplications - Array of actionApplications
 * @returns {Array<object>} Array of grouped parcels
 */
export const groupParcelsById = (actionApplications) => {
  const groupedParcels = new Map()

  actionApplications.forEach((parcel) => {
    const parcelNumber = `${parcel.sheetId}${parcel.parcelId}`
    if (groupedParcels.has(parcelNumber)) {
      const existing = groupedParcels.get(parcelNumber)
      existing.totalArea += parcel.appliedFor.quantity
    } else {
      groupedParcels.set(parcelNumber, {
        parcelNumber,
        parcelName: parcel.parcelName || '',
        totalArea: parcel.appliedFor.quantity,
        activities: groupActivitiesByParcelId(actionApplications, parcelNumber)
      })
    }
  })

  return Array.from(groupedParcels.values())
}

/**
 * Group activities by parcel ID
 * @param {Array<object>} actionApplications - Array of Action Applications
 * @param {string} parcelNumber - The parcel Number to group by
 * @returns {Array<object>} Array of grouped activities
 */
export const groupActivitiesByParcelId = (actionApplications, parcelNumber) => {
  const groupedActivities = new Map()

  // Filter actionApplications by parcelNumber
  const filteredActionApplications = actionApplications.filter(
    (parcel) => `${parcel.sheetId}${parcel.parcelId}` === parcelNumber
  )

  // Iterate over filtered actionApplications
  filteredActionApplications.forEach((parcel) => {
    const startDate = parcel.startDate || '2025-05-13'
    const endDate = parcel.endDate || '2028-05-13'

    if (groupedActivities.has(parcelNumber)) {
      const existing = groupedActivities.get(parcelNumber)
      existing.push({
        code: parcel.code,
        description: parcel.description || '',
        area: parcel.appliedFor.quantity,
        startDate,
        endDate
      })
    } else {
      groupedActivities.set(parcelNumber, [
        {
          code: parcel.code,
          description: parcel.description || '',
          area: parcel.appliedFor.quantity,
          startDate,
          endDate
        }
      ])
    }
  })

  // Convert map values to array
  return Array.from(groupedActivities.values()).flat()
}

/**
 * Create payment activites
 * @param {Array<object>} actionApplications - Array of action applications
 * @returns {Array<object>} Array of payment activities
 */
export const createPaymentActivities = (actionApplications) => {
  const groupedActivities = new Map()
  actionApplications.forEach((actionApplication) => {
    const actionCode = `${actionApplication.code}`
    if (groupedActivities.has(actionCode)) {
      const existing = groupedActivities.get(actionCode)
      existing.quantity += actionApplication.appliedFor.quantity
      existing.measurement = `${existing.quantity} ${actionApplication.appliedFor.unit}`
      existing.annualPayment = existing.quantity * existing.rate
    } else {
      const quantity = actionApplication.appliedFor.quantity
      const rate = 6.0
      groupedActivities.set(actionCode, {
        code: actionApplication.code,
        description: actionApplication.description || '',
        quantity,
        rate,
        measurement: `${actionApplication.appliedFor.quantity} ${actionApplication.appliedFor.unit}`,
        paymentRate: `${rate.toFixed(2)}/${actionApplication.appliedFor.unit}`,
        annualPayment: quantity * rate
      })
    }
  })
  return Array.from(groupedActivities.values())
}

/**
 * Calculate yearly payments
 * @param {Array<object>} activities - Array of activities
 * @returns {object} Object containing yearly totals and details
 */
export const calculateYearlyPayments = (activities) => {
  const numberOfYears = 3
  const yearlyTotals = {
    year1: 0,
    year2: 0,
    year3: 0
  }

  const details = activities.map((activity) => {
    const annualAmount = activity.annualPayment
    const totalPayment = annualAmount * numberOfYears
    yearlyTotals.year1 += annualAmount
    yearlyTotals.year2 += annualAmount
    yearlyTotals.year3 += annualAmount

    return {
      code: activity.code,
      year1: annualAmount,
      year2: annualAmount,
      year3: annualAmount,
      totalPayment
    }
  })

  return {
    details,
    annualTotals: yearlyTotals,
    totalAgreementPayment:
      yearlyTotals.year1 + yearlyTotals.year2 + yearlyTotals.year3
  }
}

/**
 * Create a new agreement
 * @param {Agreement} agreementData - The agreement data
 * @returns {Promise<Agreement>} The agreement data
 */
const createAgreement = (agreementData) => {
  if (!agreementData) {
    throw new Error('Agreement data is required')
  }

  const { identifiers, answers } = agreementData

  const parcels = groupParcelsById(answers.actionApplications)
  const paymentActivities = createPaymentActivities(answers.actionApplications)

  const data = {
    agreementNumber: generateAgreementNumber(),
    agreementName: agreementData.answers.agreementName || 'Unnamed Agreement',
    correlationId: uuidv4(),
    frn: identifiers.frn,
    sbi: identifiers.sbi,
    company: 'Sample Farm Ltd',
    address: '123 Farm Lane, Farmville',
    postcode: 'FA12 3RM',
    username: 'Diana Peart',
    agreementStartDate: '2025-05-13',
    agreementEndDate: '2028-05-13',
    actions: [],
    parcels,
    payments: {
      activities: paymentActivities,
      totalAnnualPayment: paymentActivities.reduce(
        (sum, activity) => sum + activity.annualPayment,
        0
      ),
      yearlyBreakdown: calculateYearlyPayments(paymentActivities)
    }
  }

  // Create the new agreement
  return agreementsModel.create(data)
}

export { createAgreement }

/** @import { Agreement } from '~/src/api/common/types/agreement.d.js' */
