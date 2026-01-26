/**
 * Utilities to generate OpenAPI/Swagger Joi schemas from Pact test data
 * Integrates with hapi-swagger to provide documented API schemas
 * Uses the same sample data as Pact contract tests
 */

import Joi from 'joi'
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
 * Generate array schema
 */
function generateArraySchema(sampleValue, options) {
  const itemSchema =
    sampleValue.length > 0
      ? generateJoiSchemaFromSample(sampleValue[0])
      : Joi.object().unknown(true)

  let arraySchema = Joi.array().items(itemSchema)
  if (options.description) {
    arraySchema = arraySchema.description(options.description)
  }
  if (options.label) {
    arraySchema = arraySchema.label(options.label)
  }
  return arraySchema
}

/**
 * Generate object schema
 */
function generateObjectSchema(sampleValue, options) {
  const schemaKeys = {}

  for (const [key, value] of Object.entries(sampleValue)) {
    if (value !== undefined && value !== null) {
      schemaKeys[key] = generateJoiSchemaFromSample(value, {
        description: `${key} field`
      })
    }
  }

  let objectSchema = Joi.object(schemaKeys).unknown(true)
  if (options.description) {
    objectSchema = objectSchema.description(options.description)
  }
  if (options.label) {
    objectSchema = objectSchema.label(options.label)
  }
  return objectSchema
}

/**
 * Generate primitive schema
 */
function generatePrimitiveSchema(sampleValue, options) {
  let primitiveSchema
  if (typeof sampleValue === 'string') {
    primitiveSchema = Joi.string().example(sampleValue)
  } else if (typeof sampleValue === 'number') {
    primitiveSchema = Number.isInteger(sampleValue)
      ? Joi.number().integer().example(sampleValue)
      : Joi.number().example(sampleValue)
  } else if (typeof sampleValue === 'boolean') {
    primitiveSchema = Joi.boolean().example(sampleValue)
  } else {
    primitiveSchema = Joi.any()
  }

  if (options.description) {
    primitiveSchema = primitiveSchema.description(options.description)
  }
  if (options.label) {
    primitiveSchema = primitiveSchema.label(options.label)
  }

  return primitiveSchema
}

/**
 * Generate a Joi schema from a sample object
 * This creates schemas compatible with hapi-swagger documentation
 * @param {any} sampleValue - Sample value to generate schema from
 * @param {object} options - Schema options (description, label, etc.)
 * @returns {Joi.Schema} Joi schema object
 */
export function generateJoiSchemaFromSample(sampleValue, options = {}) {
  if (sampleValue === null) {
    return Joi.any()
      .allow(null)
      .description(options.description || '')
  }

  if (Array.isArray(sampleValue)) {
    return generateArraySchema(sampleValue, options)
  }

  if (typeof sampleValue === 'object') {
    return generateObjectSchema(sampleValue, options)
  }

  // Primitive types
  return generatePrimitiveSchema(sampleValue, options)
}

/**
 * Create Joi schema for agreement identifiers
 */
export function getIdentifiersJoiSchema() {
  const sample = getSampleAgreement().identifiers
  return generateJoiSchemaFromSample(sample, {
    description: 'Business and customer identifiers',
    label: 'Identifiers'
  })
}

/**
 * Create Joi schema for agreement applicant
 */
export function getApplicantJoiSchema() {
  const sample = getSampleAgreement()

  const applicantSample = sample.applicant || {
    business: {
      name: 'J&S Hartley',
      email: { address: 'test@example.com' },
      phone: { mobile: '01234031670' },
      address: {
        line1: 'Mason House Farm Clitheroe Rd',
        line2: 'Bashall Eaves',
        street: 'Bartindale Road',
        city: 'Clitheroe',
        postalCode: 'BB7 3DD'
      }
    },
    customer: {
      name: {
        title: 'Mr.',
        first: 'Edward',
        middle: 'Paul',
        last: 'Jones'
      }
    }
  }

  return generateJoiSchemaFromSample(applicantSample, {
    description: 'Applicant business and customer details',
    label: 'Applicant'
  })
}

/**
 * Create Joi schema for agreement data response
 */
export function getAgreementDataJoiSchema() {
  const sample = getSampleAgreement()

  return generateJoiSchemaFromSample(sample, {
    description: 'Complete agreement data structure from Pact test data',
    label: 'AgreementData'
  })
}

/**
 * Get pre-defined Joi schemas for common API responses
 */
export function getCommonResponseSchemas() {
  return {
    // Agreement response with auth metadata
    agreementResponse: Joi.object({
      agreementData: getAgreementDataJoiSchema(),
      auth: Joi.object({
        source: Joi.string()
          .valid('grants-ui', 'entra')
          .description('Authentication source')
      }).description('Authentication metadata')
    }).label('AgreementResponse'),

    // Array of agreements
    agreementArrayResponse: Joi.array()
      .items(getAgreementDataJoiSchema())
      .description('Array of agreement data objects')
      .label('AgreementArrayResponse'),

    // Accept offer response
    acceptOfferResponse: Joi.object({
      agreementData: getAgreementDataJoiSchema().description(
        'The updated agreement data after acceptance'
      )
    }).label('AcceptOfferResponse')
  }
}

/**
 * Get Joi schemas for test endpoint payloads using Pact data
 */
export function getTestEndpointSchemas() {
  return {
    // Queue message payload using real agreement structure
    queueMessagePayload: Joi.object({
      data: Joi.object({
        identifiers: getIdentifiersJoiSchema(),
        applicant: getApplicantJoiSchema().optional(),
        answers: Joi.object().unknown(true).optional()
      })
        .unknown(true)
        .description('Message data payload (based on Pact test data)')
    })
      .unknown(true)
      .description('SQS message body to post to the queue')
      .label('QueueMessagePayload'),

    // Response when creating agreement via queue
    queueMessageResponse: Joi.object({
      message: Joi.string().description('Success message'),
      agreementData: getAgreementDataJoiSchema()
        .allow(null)
        .description('Created agreement data (only for create_agreement queue)')
    }).label('QueueMessageResponse')
  }
}
