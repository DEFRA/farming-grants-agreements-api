/**
 * Utilities to generate AsyncAPI/OpenAPI schemas from Pact test data
 * This approach reuses existing test data rather than duplicating schema definitions
 */

import sampleData from '~/src/api/common/helpers/sample-data/index.js'

/**
 * Get a sample agreement object from Pact test data
 * @param {number} index - Index of the agreement to retrieve (default: 1)
 * @returns {object} Sample agreement data
 */
export function getSampleAgreement(index = 1) {
  return sampleData.agreements[index]
}

/**
 * Check if a value is a leaf node (primitive or Date)
 */
function isLeafNode(value) {
  return typeof value !== 'object' || value instanceof Date || value === null
}

/**
 * Get the JSON schema type for a primitive value
 */
function getPrimitiveType(value) {
  const typeMap = {
    string: 'string',
    number: 'number',
    boolean: 'boolean'
  }
  return typeMap[typeof value] || 'string'
}

/**
 * Generate properties and required fields for an object schema
 */
function generateObjectProperties(sampleObj) {
  const properties = {}
  const required = []

  for (const [key, value] of Object.entries(sampleObj)) {
    if (value === undefined || value === null) {
      continue
    }

    properties[key] = generateSchemaFromSample(value)

    // Add example value for leaf nodes
    if (isLeafNode(value)) {
      properties[key].example = value
    }
    required.push(key)
  }

  return { properties, required }
}

/**
 * Generate a JSON schema from a sample object
 * This creates a basic schema with type information and examples
 * @param {object} sampleObj - Sample object to generate schema from
 * @param {string} description - Description of the schema
 * @returns {object} JSON schema object
 */
export function generateSchemaFromSample(sampleObj, description = '') {
  if (sampleObj === null) {
    return { type: 'null', description }
  }

  if (Array.isArray(sampleObj)) {
    const itemSchema =
      sampleObj.length > 0
        ? generateSchemaFromSample(sampleObj[0])
        : { type: 'object' }
    return {
      type: 'array',
      description,
      items: itemSchema
    }
  }

  if (typeof sampleObj === 'object') {
    const { properties, required } = generateObjectProperties(sampleObj)
    return {
      type: 'object',
      description,
      properties,
      ...(required.length > 0 && { required })
    }
  }

  // Primitive types
  return {
    type: getPrimitiveType(sampleObj),
    description,
    example: sampleObj
  }
}

/**
 * Extract the identifiers schema from sample data
 */
export function getIdentifiersSchema() {
  const sample = getSampleAgreement().identifiers
  return generateSchemaFromSample(sample, 'Business and customer identifiers')
}

/**
 * Extract application/parcel/action schemas from sample data
 */
export function getApplicationSchemas() {
  const sample = getSampleAgreement()

  // Transform the flat actionApplications into nested parcel structure
  const parcels = {}
  sample.answers?.actionApplications?.forEach((action) => {
    const key = `${action.sheetId}-${action.parcelId}`
    if (!parcels[key]) {
      parcels[key] = {
        sheetId: action.sheetId,
        parcelId: action.parcelId,
        area: action.appliedFor,
        actions: []
      }
    }
    parcels[key].actions.push({
      code: action.code,
      version: 1,
      appliedFor: action.appliedFor
    })
  })

  const parcelArray = Object.values(parcels).slice(0, 2) // Take first 2 parcels

  // Provide fallback schemas if no data available
  if (parcelArray.length === 0) {
    return {
      Application: {
        type: 'object',
        description: 'Application details including land parcels and actions',
        properties: {
          parcel: { type: 'array', items: { type: 'object' } }
        }
      },
      Parcel: {
        type: 'object',
        description: 'Land parcel with associated actions',
        properties: {
          sheetId: { type: 'string' },
          parcelId: { type: 'string' },
          area: { type: 'object' },
          actions: { type: 'array' }
        }
      },
      Action: {
        type: 'object',
        description: 'Environmental action applied to a land parcel',
        properties: {
          code: { type: 'string' },
          version: { type: 'integer' },
          appliedFor: { type: 'object' }
        }
      }
    }
  }

  const applicationSample = { parcel: parcelArray }

  return {
    Application: generateSchemaFromSample(
      applicationSample,
      'Application details including land parcels and actions'
    ),
    Parcel: generateSchemaFromSample(
      parcelArray[0],
      'Land parcel with associated actions'
    ),
    Action: generateSchemaFromSample(
      parcelArray[0].actions[0],
      'Environmental action applied to a land parcel'
    )
  }
}

/**
 * Extract payment schemas from sample data
 */
export function getPaymentSchemas() {
  const sample = getSampleAgreement()

  // Use payment data directly from sample file, fallback to answers.payment
  const paymentSample = sample.payment || sample.answers?.payment

  return {
    Payment: generateSchemaFromSample(
      paymentSample,
      'Payment schedule and calculation details'
    )
  }
}

/**
 * Extract applicant schemas from sample data
 */
export function getApplicantSchemas() {
  const sample = getSampleAgreement()

  // Use applicant data directly from sample file
  const applicantSample = sample.applicant
  if (!applicantSample) {
    // Fallback for samples without applicant field
    return {
      Applicant: {
        type: 'object',
        description: 'Applicant business and customer details'
      },
      Address: { type: 'object', description: 'Postal address' }
    }
  }

  return {
    Applicant: generateSchemaFromSample(
      applicantSample,
      'Applicant business and customer details'
    ),
    Address: generateSchemaFromSample(
      applicantSample.business.address,
      'Postal address'
    )
  }
}

/**
 * Get complete event payload examples from Pact test data
 */
export function getEventPayloadExamples() {
  const agreement = getSampleAgreement()

  return {
    createAgreement: {
      id: '12345678-1234-1234-1234-123456789012',
      source: 'fg-gas-backend',
      time: '2025-12-15T10:19:06.519Z',
      specversion: '1.0',
      type: 'cloud.defra.test.fg-gas-backend.agreement.create',
      datacontenttype: 'application/json',
      data: agreement
    },
    updateAgreement: {
      id: '12345678-1234-1234-1234-123456789012',
      source: 'fg-gas-backend',
      specversion: '1.0',
      type: 'cloud.defra.test.fg-gas-backend.agreement.withdraw',
      datacontenttype: 'application/json',
      data: {
        clientRef: agreement.clientRef,
        agreementNumber: agreement.agreementNumber,
        status: 'withdrawn'
      }
    },
    agreementStatusUpdated: {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      source: 'urn:defra:farming:agreement-service',
      specversion: '1.0',
      type: 'cloud.defra.dev.fg-gas-backend.agreement.status.updated',
      time: '2025-01-15T10:30:00.000Z',
      datacontenttype: 'application/json',
      data: {
        agreementNumber: agreement.agreementNumber,
        correlationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        clientRef: agreement.clientRef,
        version: 1,
        status: 'accepted',
        date: '2025-01-15T10:30:00.000Z',
        code: agreement.code,
        endDate:
          agreement.payment?.agreementEndDate ||
          agreement.answers?.payment?.agreementEndDate ||
          '2027-10-31'
      }
    }
  }
}
