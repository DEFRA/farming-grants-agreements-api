export const applicantSchemas = {
  Applicant: {
    type: 'object',
    description: 'Applicant business and customer details',
    properties: {
      business: {
        type: 'object',
        description: 'Business information',
        properties: {
          name: {
            type: 'string',
            description: 'Business trading name',
            example: 'J&S Hartley'
          },
          email: {
            type: 'object',
            properties: {
              address: {
                type: 'string',
                format: 'email',
                description: 'Business email address'
              }
            }
          },
          phone: {
            type: 'object',
            properties: {
              mobile: {
                type: 'string',
                description: 'Business phone number',
                example: '01234031670'
              }
            }
          },
          address: {
            $ref: '#/components/schemas/Address'
          }
        }
      },
      customer: {
        type: 'object',
        description: 'Individual customer details',
        properties: {
          name: {
            type: 'object',
            description: 'Customer name',
            properties: {
              title: {
                type: 'string',
                description: 'Title (e.g., Mr., Mrs., Ms.)',
                example: 'Mr.'
              },
              first: {
                type: 'string',
                description: 'First name',
                example: 'Edward'
              },
              middle: {
                type: 'string',
                description: 'Middle name(s)',
                example: 'Paul'
              },
              last: {
                type: 'string',
                description: 'Last name',
                example: 'Jones'
              }
            }
          }
        }
      }
    }
  }
}
