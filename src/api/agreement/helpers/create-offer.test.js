import { v4 as uuidv4 } from 'uuid'

import mongoose from 'mongoose'
import {
  createOffer,
  calculateYearlyPayments,
  createPaymentActivities,
  groupParcelsById,
  groupActivitiesByParcelId,
  generateAgreementNumber
} from './create-offer.js'
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
  frn: '1234567890',
  sbi: '106284736',
  company: 'Sample Farm Ltd',
  address: '123 Farm Lane, Farmville',
  postcode: 'FA12 3RM',
  username: 'Diana Peart',
  agreementStartDate: '2025-05-13',
  agreementEndDate: '2028-05-13',
  actions: [],
  parcels: [
    {
      parcelNumber: 'SX06799238',
      parcelName: '',
      totalArea: 62.46,
      activities: [
        {
          code: 'CSAM1',
          description: '',
          area: 20.23,
          startDate: '2025-05-13',
          endDate: '2028-05-13'
        },
        {
          code: 'CSAM3',
          description: '',
          area: 42.23,
          startDate: '2025-05-13',
          endDate: '2028-05-13'
        }
      ]
    },
    {
      parcelNumber: 'SX06799240',
      parcelName: '',
      totalArea: 10.73,
      activities: [
        {
          code: 'CSAM1',
          description: '',
          area: 10.73,
          startDate: '2025-05-13',
          endDate: '2028-05-13'
        }
      ]
    }
  ],
  payments: {
    activities: [
      {
        code: 'CSAM1',
        description: '',
        quantity: 30.96,
        rate: 6,
        measurement: '30.96 ha',
        paymentRate: '6.00/ha',
        annualPayment: 185.76
      },
      {
        code: 'CSAM3',
        description: '',
        quantity: 42.23,
        rate: 6,
        measurement: '42.23 ha',
        paymentRate: '6.00/ha',
        annualPayment: 253.38
      }
    ],
    totalAnnualPayment: 439.14,
    yearlyBreakdown: {
      details: [
        {
          code: 'CSAM1',
          year1: 185.76,
          year2: 185.76,
          year3: 185.76,
          totalPayment: 557.28
        },
        {
          code: 'CSAM3',
          year1: 253.38,
          year2: 253.38,
          year3: 253.38,
          totalPayment: 760.14
        }
      ],
      annualTotals: {
        year1: 439.14,
        year2: 439.14,
        year3: 439.14
      },
      totalAgreementPayment: 1317.42
    }
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
    ]
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

  it('should generate an agreement name when answers.agreementName is not provided', async () => {
    const emptyAgreementName = {
      identifiers: { frn: '1234567890', sbi: '106284736' },
      clientRef: 'ref-abc',
      answers: {
        // note: no agreementName here
        actionApplications: []
      }
    }

    const populated = {
      ...targetGroupDataStructure,
      sbi: '106284736',
      frn: '1234567890',
      agreementName: 'Unnamed Agreement',
      agreementNumber: 'SFI999999999',
      correlationId: 'abc-def'
    }
    populated.agreements = [{ ...targetDataStructure }]

    agreementsModel.__setPopulatedAgreement(populated)

    agreementsModel.createAgreementWithVersions.mockResolvedValue(populated)

    // Ensure the notification id hasn't been used
    doesAgreementExist.mockResolvedValueOnce(false)

    const result = await createOffer(uuidv4(), emptyAgreementName, mockLogger)

    expect(agreementsModel.createAgreementWithVersions).toHaveBeenCalledWith(
      expect.objectContaining({
        agreement: expect.objectContaining({
          agreementName: 'Unnamed Agreement'
        }),
        versions: expect.arrayContaining([
          expect.objectContaining({ agreementName: 'Unnamed Agreement' })
        ])
      })
    )

    // Should fall back to a generated SFI number
    expect(result.agreementNumber).toMatch(/^SFI\d{9}$/)
    expect(result.agreementNumber).not.toBe('')
    expect(result.agreementName).not.toBe('')
    expect(result.agreementName).toBe('Unnamed Agreement')
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

  describe('groupParcelsById', () => {
    it('should group parcels by ID', () => {
      const actionApplications = [
        {
          parcelId: '9238',
          sheetId: 'SX0679',
          code: 'CSAM1',
          appliedFor: {
            unit: 'ha',
            quantity: 20.2312345
          }
        },
        {
          parcelId: '9238',
          sheetId: 'SX0679',
          code: 'CSAM3',
          appliedFor: {
            unit: 'ha',
            quantity: 42.234321
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
      ]

      const result = groupParcelsById(actionApplications)

      expect(result).toEqual([
        {
          parcelNumber: 'SX06799238',
          parcelName: '',
          totalArea: 62.4655,
          activities: [
            {
              code: 'CSAM1',
              description: '',
              area: 20.2312345,
              startDate: '2025-05-13',
              endDate: '2028-05-13'
            },
            {
              code: 'CSAM3',
              description: '',
              area: 42.234321,
              startDate: '2025-05-13',
              endDate: '2028-05-13'
            }
          ]
        },
        {
          parcelNumber: 'SX06799240',
          parcelName: '',
          totalArea: 10.73,
          activities: [
            {
              code: 'CSAM1',
              description: '',
              area: 10.73,
              startDate: '2025-05-13',
              endDate: '2028-05-13'
            }
          ]
        }
      ])
    })

    it('should handle empty action applications array', () => {
      const result = groupParcelsById([])
      expect(result).toEqual([])
    })

    it('should handle action applications with missing appliedFor data', () => {
      const actionApplications = [
        {
          parcelId: '9238',
          sheetId: 'SX0679',
          code: 'CSAM1',
          appliedFor: null
        }
      ]

      expect(() => groupParcelsById(actionApplications)).toThrow()
    })
  })

  describe('groupActivitiesByParcelId', () => {
    it('should group activities by parcel ID', () => {
      const actionApplications = [
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
        }
      ]

      const parcelNumber = 'SX06799238'

      const result = groupActivitiesByParcelId(actionApplications, parcelNumber)

      expect(result).toEqual([
        {
          code: 'CSAM1',
          description: '',
          area: 20.23,
          startDate: '2025-05-13',
          endDate: '2028-05-13'
        },
        {
          code: 'CSAM3',
          description: '',
          area: 42.23,
          startDate: '2025-05-13',
          endDate: '2028-05-13'
        }
      ])
    })

    it('should handle empty action applications array', () => {
      const result = groupActivitiesByParcelId([], 'SX06799238')
      expect(result).toEqual([])
    })

    it('should handle action applications with custom dates', () => {
      const actionApplications = [
        {
          parcelId: '9238',
          sheetId: 'SX0679',
          code: 'CSAM1',
          startDate: '2026-01-01',
          endDate: '2027-12-31',
          appliedFor: {
            unit: 'ha',
            quantity: 20.23
          }
        }
      ]

      const parcelNumber = 'SX06799238'
      const result = groupActivitiesByParcelId(actionApplications, parcelNumber)

      expect(result[0].startDate).toBe('2026-01-01')
      expect(result[0].endDate).toBe('2027-12-31')
    })
  })

  describe('createPaymentActivities', () => {
    it('should create payment activities correctly', () => {
      const actionApplications = [
        {
          parcelId: '9238',
          sheetId: 'SX0679',
          code: 'CSAM1',
          description: '',
          appliedFor: {
            unit: 'ha',
            quantity: 20.23
          }
        },
        {
          parcelId: '9238',
          sheetId: 'SX0679',
          code: 'CSAM3',
          description: '',
          appliedFor: {
            unit: 'ha',
            quantity: 42.23
          }
        }
      ]

      const result = createPaymentActivities(actionApplications)

      expect(result).toEqual([
        {
          code: 'CSAM1',
          description: '',
          quantity: 20.23,
          rate: 6,
          measurement: '20.23 ha',
          paymentRate: '6.00/ha',
          annualPayment: 121.38
        },
        {
          code: 'CSAM3',
          description: '',
          quantity: 42.23,
          rate: 6,
          measurement: '42.23 ha',
          paymentRate: '6.00/ha',
          annualPayment: 253.38
        }
      ])
    })
  })

  describe('calculateYearlyPayments', () => {
    it('should calculate yearly payments correctly', () => {
      const activities = [
        {
          code: 'CSAM1',
          description: '',
          quantity: 30.96,
          rate: 6,
          measurement: '30.96 ha',
          paymentRate: '6.00/ha',
          annualPayment: 185.76
        },
        {
          code: 'CSAM3',
          description: '',
          quantity: 42.23,
          rate: 6,
          measurement: '42.23 ha',
          paymentRate: '6.00/ha',
          annualPayment: 253.38
        }
      ]

      const result = calculateYearlyPayments(activities)

      expect(result).toEqual({
        details: [
          {
            code: 'CSAM1',
            year1: 185.76,
            year2: 185.76,
            year3: 185.76,
            totalPayment: 557.28
          },
          {
            code: 'CSAM3',
            year1: 253.38,
            year2: 253.38,
            year3: 253.38,
            totalPayment: 760.14
          }
        ],
        annualTotals: {
          year1: 439.14,
          year2: 439.14,
          year3: 439.14
        },
        totalAgreementPayment: 1317.42
      })
    })

    it('should handle empty activities array', () => {
      const result = calculateYearlyPayments([])
      expect(result).toEqual({
        details: [],
        annualTotals: {
          year1: 0,
          year2: 0,
          year3: 0
        },
        totalAgreementPayment: 0
      })
    })

    it('should handle activities with zero payment', () => {
      const activities = [
        {
          code: 'CSAM1',
          description: '',
          quantity: 0,
          rate: 6,
          measurement: '0 ha',
          paymentRate: '6.00/ha',
          annualPayment: 0
        }
      ]

      const result = calculateYearlyPayments(activities)
      expect(result).toEqual({
        details: [
          {
            code: 'CSAM1',
            year1: 0,
            year2: 0,
            year3: 0,
            totalPayment: 0
          }
        ],
        annualTotals: {
          year1: 0,
          year2: 0,
          year3: 0
        },
        totalAgreementPayment: 0
      })
    })

    it('should handle activities with decimal payments', () => {
      const activities = [
        {
          code: 'CSAM1',
          description: '',
          quantity: 1.5,
          rate: 6,
          measurement: '1.5 ha',
          paymentRate: '6.00/ha',
          annualPayment: 9
        }
      ]

      const result = calculateYearlyPayments(activities)
      expect(result).toEqual({
        details: [
          {
            code: 'CSAM1',
            year1: 9,
            year2: 9,
            year3: 9,
            totalPayment: 27
          }
        ],
        annualTotals: {
          year1: 9,
          year2: 9,
          year3: 9
        },
        totalAgreementPayment: 27
      })
    })
  })

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

describe('createPaymentActivities', () => {
  it('should handle empty action applications', () => {
    const result = createPaymentActivities([])
    expect(result).toEqual([])
  })

  it('should handle action applications with missing description', () => {
    const actionApplications = [
      {
        parcelId: '9238',
        sheetId: 'SX0679',
        code: 'CSAM1',
        appliedFor: {
          unit: 'ha',
          quantity: 20.23
        }
      }
    ]

    const result = createPaymentActivities(actionApplications)
    expect(result[0].description).toBe('')
  })

  it('should handle action applications with different units', () => {
    const actionApplications = [
      {
        parcelId: '9238',
        sheetId: 'SX0679',
        code: 'CSAM1',
        appliedFor: {
          unit: 'm',
          quantity: 100
        }
      }
    ]

    const result = createPaymentActivities(actionApplications)
    expect(result[0].measurement).toBe('100 m')
    expect(result[0].paymentRate).toBe('6.00/m')
  })

  it('should combine quantities for the same action code', () => {
    const actionApplications = [
      {
        parcelId: '9238',
        sheetId: 'SX0679',
        code: 'CSAM1',
        appliedFor: {
          unit: 'ha',
          quantity: 10
        }
      },
      {
        parcelId: '9240',
        sheetId: 'SX0679',
        code: 'CSAM1',
        appliedFor: {
          unit: 'ha',
          quantity: 20
        }
      }
    ]

    const result = createPaymentActivities(actionApplications)
    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(30)
    expect(result[0].annualPayment).toBe(180)
  })
})
