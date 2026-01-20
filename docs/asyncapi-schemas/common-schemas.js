export const commonSchemas = {
  Identifiers: {
    type: 'object',
    description: 'Business and customer identifiers',
    required: ['sbi'],
    properties: {
      sbi: {
        type: 'string',
        description:
          'Single Business Identifier - unique identifier for the farming business',
        example: '106284736'
      },
      frn: {
        type: 'string',
        description: 'Firm Reference Number',
        example: '1234567890'
      },
      crn: {
        type: 'string',
        description: 'Customer Reference Number',
        example: 'CRN123456'
      },
      defraId: {
        type: 'string',
        description: 'Defra customer identity ID',
        example: 'defra-id-123'
      }
    }
  },
  Address: {
    type: 'object',
    description: 'Postal address',
    properties: {
      line1: {
        type: 'string',
        description: 'Address line 1',
        example: 'Mason House Farm Clitheroe Rd'
      },
      line2: {
        type: 'string',
        description: 'Address line 2',
        example: 'Bashall Eaves'
      },
      line3: {
        type: 'string',
        nullable: true,
        description: 'Address line 3'
      },
      line4: {
        type: 'string',
        nullable: true,
        description: 'Address line 4'
      },
      line5: {
        type: 'string',
        nullable: true,
        description: 'Address line 5'
      },
      street: {
        type: 'string',
        description: 'Street name',
        example: 'Bartindale Road'
      },
      city: {
        type: 'string',
        description: 'City or town',
        example: 'Clitheroe'
      },
      postalCode: {
        type: 'string',
        description: 'Postal code',
        example: 'BB7 3DD'
      }
    }
  }
}
