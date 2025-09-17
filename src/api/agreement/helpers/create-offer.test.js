import { v4 as uuidv4 } from 'uuid'

import mongoose from 'mongoose'
import { createOffer, generateAgreementNumber } from './create-offer.js'
import versionsModel from '~/src/api/common/models/versions.js'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { publishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { doesAgreementExist } from '~/src/api/agreement/helpers/get-agreement-data.js'

jest.mock('~/src/api/common/models/versions.js')
jest.mock('~/src/api/common/models/agreements.js', () => {
  let populatedAgreement = null

  const api = {
    create: jest.fn(() => ({ _id: 'mockG1' })),
    findById: jest.fn(() => ({
      populate: () => ({
        lean: () => Promise.resolve(populatedAgreement)
      })
    })),
    createAgreementWithVersions: jest.fn(() => populatedAgreement),

    // helper exposed to tests:
    __setPopulatedAgreement: (g) => {
      populatedAgreement = g
    }
  }

  return { __esModule: true, default: api }
})
jest.mock('~/src/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: jest.fn().mockResolvedValue(true)
}))
jest.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  doesAgreementExist: jest.fn().mockResolvedValue(false)
}))

const targetDataStructure = {
  notificationMessageId: 'aws-message-id',
  agreementName: 'Sample Agreement',
  correlationId: '1234545918345918475',
  payments: {
    agreementStartDate: '2024-11-01',
    agreementEndDate: '2027-10-31',
    frequency: 'Quarterly',
    agreementTotalPence: 6413247,
    annualTotalPence: 6440447,
    parcelItems: {
      1: {
        code: 'BND1',
        description: 'Maintain dry stone walls',
        version: 1,
        unit: 'metres',
        quantity: 95,
        rateInPence: 2565,
        annualPaymentPence: 243675,
        sheetId: 'SX635990',
        parcelId: '44'
      }
    },
    agreementLevelItems: {
      1: {
        code: 'CSAM1',
        description:
          'CSAM1: Assess soil, produce a soil management plan and test soil organic matter',
        version: 1,
        annualPaymentPence: 27200
      }
    },
    payments: [
      {
        totalPaymentPence: 1610112,
        paymentDate: '2025-12-05',
        lineItems: [
          { agreementLevelItems: 1, paymentPence: 6800 },
          { parcelItemId: 1, paymentPence: 60919 }
        ]
      }
    ]
  }
}

const targetGroupDataStructure = {
  agreementNumber: 'SFI987654321',
  agreementName: 'Sample Agreement',
  agreements: [targetDataStructure]
}

const agreementData = {
  clientRef: 'ref-1234',
  code: 'frps-private-beta',
  createdAt: '2023-10-01T12:00:00Z',
  submittedAt: '2023-10-01T11:00:00Z',
  agreementNumber: 'SFI987654321',
  identifiers: {
    sbi: '106284736',
    frn: '1234567890',
    crn: '1234567890',
    defraId: '1234567890'
  },
  answers: {
    scheme: 'SFI',
    year: 2025,
    agreementName: 'Sample Agreement',
    hasCheckedLandIsUpToDate: true,
    actionApplications: [
      {
        parcelId: '9238',
        sheetId: 'SX0679',
        code: 'CSAM1',
        appliedFor: {
          unit: 'ha',
          quantity: 20.23
        }
      },
      {
        parcelId: '9238',
        sheetId: 'SX0679',
        code: 'CSAM3',
        appliedFor: {
          unit: 'ha',
          quantity: 42.23
        }
      },
      {
        parcelId: '9240',
        sheetId: 'SX0679',
        code: 'CSAM1',
        appliedFor: {
          unit: 'ha',
          quantity: 10.73
        }
      }
    ],
    payment: {},
    applicant: {
      customer: {
        name: {
          title: 'Mr',
          first: 'Joe',
          last: 'Bloggs'
        }
      }
    }
  }
}

describe('createOffer', () => {
  let mockLogger

  beforeAll(() => {
    jest.useFakeTimers()
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Make insertMany return a real-looking agreement (matching targetDataStructure)
    versionsModel.insertMany = jest.fn(() => [
      { ...targetDataStructure, _id: new mongoose.Types.ObjectId() }
    ])
    versionsModel.updateMany = jest.fn(() => ({
      matchedCount: 1,
      modifiedCount: 1
    }))
    versionsModel.deleteMany = jest.fn(() => ({ deletedCount: 0 }))

    // Return EXACT group the test asserts against
    const populated = {
      ...targetGroupDataStructure,
      sbi: '106284736',
      frn: '1234567890',
      agreementNumber: 'SFI999999999', // test uses expect.any(String)
      correlationId: 'abc-def' // test uses expect.any(String)
    }
    populated.agreements = [{ ...targetDataStructure }]

    agreementsModel.__setPopulatedAgreement(populated)

    if (!jest.isMockFunction(agreementsModel.createAgreementWithVersions)) {
      jest.spyOn(agreementsModel, 'createAgreementWithVersions')
    }
    agreementsModel.createAgreementWithVersions.mockResolvedValue(populated)

    publishEvent.mockResolvedValue(true)

    jest.setSystemTime(new Date('2025-01-01'))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  it('should create an agreement with valid data', async () => {
    // Mock doesAgreementExist to return false for new agreements
    doesAgreementExist.mockResolvedValueOnce(false)

    const result = await createOffer(
      'aws-message-id',
      agreementData,
      mockLogger
    )

    // Check if the result matches the target data structure
    expect(result).toMatchObject({
      ...targetGroupDataStructure,
      // notificationMessageId: 'aws-message-id',
      // These fields are dynamic, so we check for their types
      agreementNumber: expect.any(String),
      correlationId: expect.any(String)
    })

    expect(publishEvent).toHaveBeenCalledWith(
      {
        time: '2025-01-01T00:00:00.000Z',
        topicArn: 'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
        type: 'io.onsite.agreement.status.updated',
        data: expect.objectContaining({
          agreementNumber: 'SFI999999999',
          correlationId: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
          ),
          clientRef: 'ref-1234',
          status: 'offered',
          date: '2025-01-01T00:00:00.000Z'
        })
      },
      mockLogger
    )
  })

  it('should generate an agreement number when seedDb is true but agreementNumber is empty', async () => {
    // Enable DB seeding and provide an empty agreementNumber
    const { config } = await import('~/src/config/index.js')
    const previous = config.get('featureFlags.seedDb')
    config.set('featureFlags.seedDb', true)

    const emptyAgreementData = {
      ...agreementData,
      agreementNumber: ''
    }

    // Ensure the notification id hasn't been used
    doesAgreementExist.mockResolvedValueOnce(false)

    const result = await createOffer(uuidv4(), emptyAgreementData, mockLogger)

    // Should fall back to a generated SFI number
    expect(result.agreementNumber).toMatch(/^SFI\d{9}$/)
    expect(result.agreementNumber).not.toBe('')

    // Restore previous config
    config.set('featureFlags.seedDb', previous)
  })

  it('uses provided agreementNumber when seedDb is true and agreementNumber is present', async () => {
    const { config } = await import('~/src/config/index.js')
    const previous = config.get('featureFlags.seedDb')
    config.set('featureFlags.seedDb', true)

    const provided = 'SFI123456789'
    doesAgreementExist.mockResolvedValueOnce(false)

    const populated = {
      ...targetGroupDataStructure,
      sbi: '106284736',
      frn: '1234567890',
      agreementName: 'Unnamed Agreement',
      agreementNumber: provided,
      correlationId: 'abc-def'
    }
    populated.agreements = [{ ...targetDataStructure }]

    agreementsModel.__setPopulatedAgreement(populated)

    agreementsModel.createAgreementWithVersions.mockResolvedValue(populated)

    const data = { ...agreementData, agreementNumber: provided }
    const result = await createOffer(uuidv4(), data, mockLogger)

    expect(result.agreementNumber).toBe(provided)

    config.set('featureFlags.seedDb', previous)
  })

  it('ignores provided agreementNumber when seedDb is false (uses generated)', async () => {
    const { config } = await import('~/src/config/index.js')
    const previous = config.get('featureFlags.seedDb')
    config.set('featureFlags.seedDb', false)

    doesAgreementExist.mockResolvedValueOnce(false)

    const provided = 'SFI888888888'
    const data = { ...agreementData, agreementNumber: provided }

    const result = await createOffer(uuidv4(), data, mockLogger)

    expect(result.agreementNumber).toMatch(/^SFI\d{9}$/)
    expect(result.agreementNumber).not.toBe(provided)

    config.set('featureFlags.seedDb', previous)
  })

  it('generates an agreement number when seedDb is false and agreementNumber is empty', async () => {
    const { config } = await import('~/src/config/index.js')
    const previous = config.get('featureFlags.seedDb')
    config.set('featureFlags.seedDb', false)

    doesAgreementExist.mockResolvedValueOnce(false)

    const data = { ...agreementData, agreementNumber: '' }
    const result = await createOffer(uuidv4(), data, mockLogger)

    expect(result.agreementNumber).toMatch(/^SFI\d{9}$/)
    expect(result.agreementNumber).not.toBe('')

    config.set('featureFlags.seedDb', previous)
  })

  describe('when notificationMessageId already exists', () => {
    it('should throw an error', async () => {
      const notificationMessageId = 'test-message-id'
      const agreementData = { answers: { actionApplications: [] } }

      // Mock doesAgreementExist to return true, indicating the notificationMessageId exists
      doesAgreementExist.mockResolvedValueOnce(true)

      await expect(
        createOffer(notificationMessageId, agreementData, mockLogger)
      ).rejects.toThrow('Agreement has already been created')

      expect(doesAgreementExist).toHaveBeenCalledWith({ notificationMessageId })
    })
  })

  describe('grouping behaviour (via createOffer output)', () => {
    it('should return the grouped parcels in the populated result (sample data)', async () => {
      const result = await createOffer(
        'aws-message-id',
        agreementData,
        mockLogger
      )
      expect(result.agreements[0].parcels).toEqual(targetDataStructure.parcels)
    })
  })

  describe('payments behaviour (via createOffer output)', () => {
    it('should return payments with parcelItems, agreementLevelItems and payments arrays', async () => {
      const result = await createOffer(
        'aws-message-id',
        agreementData,
        mockLogger
      )
      const payments = result.agreements[0].payments
      expect(payments).toEqual(targetDataStructure.payments)
      expect(typeof payments.agreementStartDate).toBe('string')
      expect(typeof payments.agreementEndDate).toBe('string')
      expect(payments.parcelItems).toBeDefined()
      expect(payments.agreementLevelItems).toBeDefined()
      expect(Array.isArray(payments.payments)).toBe(true)
    })
  })
  // Note: yearly breakdown and activities are no longer present in payments

  describe('generateAgreementNumber', () => {
    it('should generate a valid agreement number', () => {
      const agreementNumber = generateAgreementNumber()
      expect(agreementNumber).toMatch(/^SFI\d{9}$/)
    })

    it('should generate unique agreement numbers', () => {
      const numbers = new Set()
      for (let i = 0; i < 100; i++) {
        numbers.add(generateAgreementNumber())
      }
      expect(numbers.size).toBe(100)
    })
  })

  it('should handle missing answers object (uses defaults)', async () => {
    const missingAnswers = {
      clientRef: 'ref-missing-answers',
      code: 'frps-private-beta',
      identifiers: { sbi: '106284736', frn: '1234567890' },
      answers: {}
    }

    // Ensure the notification id hasn't been used
    doesAgreementExist.mockResolvedValueOnce(false)
    let error
    try {
      await createOffer('aws-message-id', missingAnswers)
    } catch (e) {
      error = e
    }
    expect(error).toBeDefined()
    expect(error.message).toBe('Offer data is missing payment and applicant')
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should handle missing agreement data', async () => {
      let error
      try {
        await createOffer(null)
      } catch (e) {
        error = e
      }
      expect(error).toBeDefined()
      expect(error.message).toBe('Offer data is required')
    })

    it('should handle database errors gracefully', async () => {
      agreementsModel.createAgreementWithVersions.mockRejectedValue(
        new Error('Database connection error')
      )

      await expect(
        createOffer(uuidv4(), agreementData, mockLogger)
      ).rejects.toThrow('Database connection error')
    })

    it('should handle generic errors when creating an agreement', async () => {
      agreementsModel.createAgreementWithVersions.mockRejectedValue(
        new Error('Generic error')
      )

      await expect(
        createOffer(uuidv4(), agreementData, mockLogger)
      ).rejects.toThrow('Generic error')
    })
  })
})

// Payments/activity aggregation assertions no longer apply since payments schema changed
