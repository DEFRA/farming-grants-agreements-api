import Boom from '@hapi/boom'

export const unacceptAgreement = jest.fn().mockImplementation((agreementId) => {
  if (agreementId === 'SFI123456789') {
    return {
      acknowledged: true,
      modifiedCount: 1
    }
  } else {
    throw Boom.notFound(new Error('Agreement not found'))
  }
})
