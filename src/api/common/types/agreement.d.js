/**
 * Represents an action in the system
 * @typedef {object} Action
 * @property {string} code - The unique identifier code for the action
 * @property {string} title - The title or name of the action
 * @property {Date} startDate - The date when the action begins
 * @property {Date} endDate - The date when the action ends
 * @property {string} duration - The duration of the action
 */

/**
 * Represents an activity in the system
 * @typedef {object} Activity
 * @property {string} code - The unique identifier code for the activity
 * @property {string} description - The description of the activity
 * @property {number} area - The area covered by the activity
 * @property {Date} startDate - The date when the activity begins
 * @property {Date} endDate - The date when the activity ends
 */

/**
 * Represents a land parcel schema structure.
 * @typedef {object} Parcel
 * @property {string} parcelNumber - The unique identifier for the parcel
 * @property {string} [parcelName=''] - The name of the parcel (optional with default empty string)
 * @property {number} totalArea - The total area of the parcel
 * @property {Activity[]} [activities=[]] - Array of activities associated with the parcel (optional with default empty array)
 */

/**
 * Represents the yearly breakdown of agreement payments
 * @typedef {object} YearlyBreakdown
 * @property {object[]} details - Array of detail objects for the breakdown
 * @property {object} annualTotals - The annual payment totals
 * @property {number} annualTotals.year1 - Payment total for year 1
 * @property {number} annualTotals.year2 - Payment total for year 2
 * @property {number} annualTotals.year3 - Payment total for year 3
 * @property {number} totalAgreementPayment - The total payment amount for the entire agreement
 */

/**
 * @typedef {object} Payments
 * @property {object[]} activities - Array of activities associated with the payment
 * @property {number} totalAnnualPayment - The total annual payment amount
 * @property {YearlyBreakdown} yearlyBreakdown - Breakdown of payments by year
 */

/**
 * @typedef {object} Agreement
 * @property {string} agreementNumber - The unique identifier for the agreement
 * @property {string} agreementName - The name of the agreement
 * @property {string} sbi - Single Business Identifier
 * @property {string} company - Company name
 * @property {string} address - Company address
 * @property {string} postcode - Company postcode
 * @property {string} username - Username associated with the agreement
 * @property {Date} agreementStartDate - Start date of the agreement
 * @property {Date} agreementEndDate - End date of the agreement
 * @property {('offered'|'accepted')} status - Current status of the agreement
 * @property {Date} [signatureDate] - Date when agreement was signed
 * @property {Date} [terminationDate] - Date when agreement was terminated
 * @property {Action[]} actions - Array of actions associated with the agreement
 * @property {Parcel[]} parcels - Array of parcels associated with the agreement
 * @property {Payments} payments - Payment information for the agreement
 */
