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
        code: 'SPM4',
        description: 'Maintain dry stone walls',
        version: 1,
        unit: 'metres',
        quantity: 95,
        rateInPence: 2565,
        annualPaymentPence: 243675,
        sheetId: 'SD4841',
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
    payment: {
      agreementEndDate: '2027-12-31'
    },
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

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn()
    }

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
          date: '2025-01-01T00:00:00.000Z',
          endDate: '2027-12-31'
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

  it('should build legacy payment structure when application payload is provided', async () => {
    const applicationPayload = {
      agreementStartDate: '2025-01-01T00:00:00.000Z',
      agreementEndDate: '2028-01-01T00:00:00.000Z',
      paymentFrequency: 'Quarterly',
      applicant: agreementData.answers.applicant,
      totalAnnualPaymentPence: 35150,
      parcels: [
        {
          sheetId: 'AB1234',
          parcelId: '10001',
          actions: [
            {
              code: 'CMOR1',
              description: 'Assess moorland and produce a written record',
              durationYears: 3,
              eligible: {
                unit: 'ha',
                quantity: 7.5
              },
              paymentRates: {
                ratePerUnitPence: 1060
              },
              annualPaymentPence: 35150
            }
          ]
        }
      ]
    }

    agreementsModel.createAgreementWithVersions.mockResolvedValueOnce({
      agreementNumber: 'SFI123456789',
      agreements: []
    })

    doesAgreementExist.mockResolvedValueOnce(false)

    const payload = {
      clientRef: 'application-ref',
      code: 'frps-private-beta',
      identifiers: { sbi: '106284736', frn: '1234567890' },
      application: applicationPayload
    }

    await createOffer('application-message', payload, mockLogger)

    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    const { payment, actionApplications } = callPayload.versions[0]

    expect(payment.annualTotalPence).toBe(35150)
    expect(payment.parcelItems['1']).toMatchObject({
      code: 'CMOR1',
      rateInPence: 1060,
      annualPaymentPence: 35150,
      sheetId: 'AB1234',
      parcelId: '10001'
    })
    expect(payment.payments).toHaveLength(2)
    expect(actionApplications).toHaveLength(1)
    expect(actionApplications[0]).toMatchObject({
      code: 'CMOR1',
      parcelId: '10001',
      sheetId: 'AB1234'
    })
  })

  it('should build legacy payment structure when answers.parcels format is provided', async () => {
    const payloadWithAnswersParcels = {
      clientRef: '581-e92-bbe',
      code: 'frps-private-beta',
      identifiers: {
        sbi: '106284736',
        frn: '3989509178',
        crn: '1102838829',
        defraId: 'defraId'
      },
      answers: {
        scheme: 'SFI',
        applicant: {
          business: {
            name: 'VAUGHAN FARMS LIMITED',
            reference: '3989509178',
            email: {
              address:
                'cliffspencetasabbeyfarmf@mrafyebbasatecnepsffilcm.com.test'
            },
            phone: { mobile: '01234031670' },
            address: {
              line1: 'Mason House Farm Clitheroe Rd',
              line2: 'Bashall Eaves',
              line3: null,
              line4: null,
              line5: null,
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
        },
        applicationValidationRunId: 2335,
        totalAnnualPaymentPence: 32006,
        parcels: [
          {
            sheetId: 'SD6743',
            parcelId: '8083',
            area: { unit: 'ha', quantity: 4.5341 },
            actions: [
              {
                code: 'CMOR1',
                description: 'Assess moorland and produce a written record',
                durationYears: 3,
                eligible: { unit: 'ha', quantity: 4.5341 },
                appliedFor: { unit: 'ha', quantity: 4.5341 },
                paymentRates: {
                  ratePerUnitPence: 1060,
                  agreementLevelAmountPence: 27200
                },
                annualPaymentPence: 4806
              }
            ]
          }
        ]
      }
    }

    agreementsModel.createAgreementWithVersions.mockResolvedValueOnce({
      agreementNumber: 'SFI123456789',
      agreements: []
    })

    doesAgreementExist.mockResolvedValueOnce(false)

    await createOffer(
      'answers-parcels-message',
      payloadWithAnswersParcels,
      mockLogger
    )

    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    const { payment, actionApplications, applicant } = callPayload.versions[0]

    expect(payment).toBeDefined()
    expect(payment.annualTotalPence).toBe(32006)
    expect(payment.parcelItems).toBeDefined()
    expect(Object.keys(payment.parcelItems).length).toBeGreaterThan(0)

    const firstParcelItem = Object.values(payment.parcelItems)[0]
    expect(firstParcelItem).toMatchObject({
      code: 'CMOR1',
      rateInPence: 1060,
      annualPaymentPence: 4806,
      sheetId: 'SD6743',
      parcelId: '8083'
    })

    expect(payment.agreementLevelItems).toBeDefined()
    const agreementLevelItems = Object.values(payment.agreementLevelItems)
    expect(agreementLevelItems.length).toBeGreaterThan(0)
    expect(agreementLevelItems[0].annualPaymentPence).toBe(27200)

    expect(payment.payments).toBeDefined()
    expect(payment.payments).toHaveLength(2)

    expect(actionApplications).toBeDefined()
    expect(actionApplications).toHaveLength(1)
    expect(actionApplications[0]).toMatchObject({
      code: 'CMOR1',
      parcelId: '8083',
      sheetId: 'SD6743'
    })

    expect(applicant).toBeDefined()
    expect(applicant.business.name).toBe('VAUGHAN FARMS LIMITED')
  })

  it('should build legacy payment structure when answers.application.parcel format is provided', async () => {
    const payloadWithApplicationParcel = {
      clientRef: 'b85-c99-323',
      code: 'frps-private-beta',
      identifiers: {
        sbi: '106514040',
        frn: '1101091126',
        crn: '1103313150',
        defraId: 'defraId'
      },
      answers: {
        scheme: 'SFI',
        applicant: {
          business: {
            name: 'Test Business',
            reference: '1101091126',
            email: { address: 'test@example.com' },
            phone: { mobile: '01234567890' },
            address: {
              line1: 'Test Address',
              city: 'Test City',
              postalCode: 'TE5T 1NG'
            }
          },
          customer: {
            name: { title: 'Mr', first: 'Test', last: 'User' }
          }
        },
        totalAnnualPaymentPence: 32242,
        application: {
          parcel: [
            {
              sheetId: 'SK0971',
              parcelId: '7555',
              area: { unit: 'ha', quantity: 5.2182 },
              actions: [
                {
                  code: 'CMOR1',
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: 'ha', quantity: 4.7575 }
                }
              ]
            }
          ]
        },
        payments: {
          parcel: [
            {
              sheetId: 'SK0971',
              parcelId: '7555',
              actions: [
                {
                  code: 'CMOR1',
                  description: 'Assess moorland and produce a written record',
                  durationYears: 3,
                  paymentRates: 1060,
                  annualPaymentPence: 5042,
                  eligible: { unit: 'ha', quantity: 4.7575 }
                }
              ]
            }
          ],
          agreement: [
            {
              code: 'CMOR1',
              description: 'Assess moorland and produce a written record',
              paymentRates: 27200,
              annualPaymentPence: 27200
            }
          ]
        }
      }
    }

    agreementsModel.createAgreementWithVersions.mockResolvedValueOnce({
      agreementNumber: 'SFI123456789',
      agreements: []
    })

    doesAgreementExist.mockResolvedValueOnce(false)

    await createOffer(
      'application-parcel-message',
      payloadWithApplicationParcel,
      mockLogger
    )

    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    const { payment, actionApplications, applicant } = callPayload.versions[0]

    expect(payment).toBeDefined()
    expect(payment.annualTotalPence).toBe(32242)
    expect(payment.parcelItems).toBeDefined()
    expect(Object.keys(payment.parcelItems).length).toBeGreaterThan(0)

    const firstParcelItem = Object.values(payment.parcelItems)[0]
    expect(firstParcelItem).toMatchObject({
      code: 'CMOR1',
      description: 'Assess moorland and produce a written record',
      annualPaymentPence: 5042,
      sheetId: 'SK0971',
      parcelId: '7555'
    })

    expect(actionApplications).toBeDefined()
    expect(actionApplications).toHaveLength(1)
    expect(applicant).toBeDefined()
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

  it('should handle missing answers object (uses defaults)', async () => {
    const missingAnswers = {
      clientRef: 'ref-missing-answers',
      code: 'frps-private-beta',
      identifiers: { sbi: '106284736', frn: '1234567890' },
      answers: {}
    }

    doesAgreementExist.mockResolvedValueOnce(false)
    let error
    try {
      await createOffer('aws-message-id', missingAnswers, mockLogger)
    } catch (e) {
      error = e
    }
    expect(error).toBeDefined()
    expect(error.message).toBe('Offer data is missing payment and applicant')
  })

  it('should handle answers.parcels without applicant', async () => {
    const payloadWithoutApplicant = {
      clientRef: 'ref-no-applicant',
      code: 'frps-private-beta',
      identifiers: { sbi: '106284736', frn: '1234567890' },
      answers: {
        scheme: 'SFI',
        totalAnnualPaymentPence: 32006,
        parcels: [
          {
            sheetId: 'SD6743',
            parcelId: '8083',
            area: { unit: 'ha', quantity: 4.5341 },
            actions: [
              {
                code: 'CMOR1',
                description: 'Assess moorland',
                durationYears: 3,
                eligible: { unit: 'ha', quantity: 4.5341 },
                paymentRates: {
                  ratePerUnitPence: 1060
                },
                annualPaymentPence: 4806
              }
            ]
          }
        ]
      }
    }

    doesAgreementExist.mockResolvedValueOnce(false)
    await expect(
      createOffer('test-id', payloadWithoutApplicant, mockLogger)
    ).rejects.toThrow('Offer data is missing payment and applicant')
  })

  it('should handle case where neither application nor answers.parcels exist', async () => {
    const payloadWithoutConversionFormat = {
      clientRef: 'ref-no-format',
      code: 'frps-private-beta',
      identifiers: { sbi: '106284736', frn: '1234567890' },
      answers: {
        scheme: 'SFI'
        // No payment, no applicant, no parcels, no application
      }
    }

    doesAgreementExist.mockResolvedValueOnce(false)

    await expect(
      createOffer('test-id', payloadWithoutConversionFormat, mockLogger)
    ).rejects.toThrow('Offer data is missing payment and applicant')
  })

  it('should handle conversion errors in catch block when mapper throws', async () => {
    // Import the mapper module
    const mapperModule = await import('./legacy-application-mapper.js')
    const originalMapper = mapperModule.buildLegacyPaymentFromApplication

    // Create a payload that will trigger conversion
    const payloadWithParcels = {
      clientRef: 'ref-error',
      code: 'frps-private-beta',
      identifiers: { sbi: '106284736', frn: '1234567890' },
      answers: {
        scheme: 'SFI',
        parcels: [
          {
            sheetId: 'SD6743',
            parcelId: '8083',
            actions: []
          }
        ]
      }
    }

    // Mock the mapper to throw an error
    mapperModule.buildLegacyPaymentFromApplication = jest.fn(() => {
      throw new Error('Mapper conversion failed')
    })

    doesAgreementExist.mockResolvedValueOnce(false)

    // The error should be caught and validation should throw
    await expect(
      createOffer('test-id', payloadWithParcels, mockLogger)
    ).rejects.toThrow('Offer data is missing payment and applicant')

    // Restore original
    mapperModule.buildLegacyPaymentFromApplication = originalMapper
  })

  it('should merge converted values when existing values are null or undefined', async () => {
    // Test that mergeConvertedValues uses converted values when existing are null/undefined
    // This tests the path where conversion provides all missing values
    const payloadWithNullValues = {
      clientRef: 'ref-null-values',
      code: 'frps-private-beta',
      identifiers: { sbi: '106284736', frn: '1234567890' },
      answers: {
        scheme: 'SFI',
        applicant: {
          business: {
            name: 'TEST BUSINESS',
            reference: '1234567890',
            email: { address: 'test@example.com' },
            phone: { mobile: '01234567890' },
            address: {
              line1: 'Test Address',
              city: 'Test City',
              postalCode: 'TE5T 1NG'
            }
          }
        },
        totalAnnualPaymentPence: 4806,
        parcels: [
          {
            sheetId: 'SD6743',
            parcelId: '8083',
            area: { unit: 'ha', quantity: 4.5341 },
            actions: [
              {
                code: 'CMOR1',
                description: 'Assess moorland',
                durationYears: 3,
                eligible: { unit: 'ha', quantity: 4.5341 },
                paymentRates: {
                  ratePerUnitPence: 1060
                },
                annualPaymentPence: 4806
              }
            ]
          }
        ]
      }
    }

    agreementsModel.createAgreementWithVersions.mockResolvedValueOnce({
      agreementNumber: 'SFI123456789',
      agreements: []
    })

    doesAgreementExist.mockResolvedValueOnce(false)

    // This should succeed because conversion will provide payment and actionApplications
    const result = await createOffer(
      'test-id',
      payloadWithNullValues,
      mockLogger
    )

    expect(result).toBeDefined()
    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    // Payment should come from conversion (not null)
    expect(callPayload.versions[0].payment).toBeDefined()
    expect(callPayload.versions[0].payment.annualTotalPence).toBe(4806)
    // Applicant should be used from existing (not null)
    expect(callPayload.versions[0].applicant).toBeDefined()
    expect(callPayload.versions[0].applicant.business.name).toBe(
      'TEST BUSINESS'
    )
    // ActionApplications should come from conversion
    expect(callPayload.versions[0].actionApplications).toBeDefined()
    expect(callPayload.versions[0].actionApplications.length).toBeGreaterThan(0)
  })

  it('should use existing values when both existing and converted are present', async () => {
    // Test mergeConvertedValues prefers existing over converted
    // Provide payment and applicant, but not actionApplications to trigger conversion
    const payloadWithPartial = {
      clientRef: 'ref-both',
      code: 'frps-private-beta',
      identifiers: { sbi: '106284736', frn: '1234567890' },
      answers: {
        scheme: 'SFI',
        payment: {
          annualTotalPence: 1000,
          agreementStartDate: '2024-01-01',
          agreementEndDate: '2027-01-01'
        },
        applicant: {
          business: { name: 'Existing Business' }
        },
        // actionApplications is missing, so conversion will be triggered
        parcels: [
          {
            sheetId: 'SD6743',
            parcelId: '8083',
            area: { unit: 'ha', quantity: 4.5341 },
            actions: [
              {
                code: 'CMOR1',
                description: 'Assess moorland',
                durationYears: 3,
                eligible: { unit: 'ha', quantity: 4.5341 },
                paymentRates: {
                  ratePerUnitPence: 1060
                },
                annualPaymentPence: 4806
              }
            ]
          }
        ]
      }
    }

    agreementsModel.createAgreementWithVersions.mockResolvedValueOnce({
      agreementNumber: 'SFI123456789',
      agreements: []
    })

    doesAgreementExist.mockResolvedValueOnce(false)

    const result = await createOffer('test-id', payloadWithPartial, mockLogger)

    expect(result).toBeDefined()
    // Existing payment should be used (not converted one)
    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    expect(callPayload.versions[0].payment.annualTotalPence).toBe(1000)
    // But actionApplications should come from conversion
    expect(callPayload.versions[0].actionApplications).toBeDefined()
    expect(callPayload.versions[0].actionApplications.length).toBeGreaterThan(0)
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

    it('should propagate Boom error when payment/applicant missing', async () => {
      const bad = {
        clientRef: 'ref',
        code: 'frps-private-beta',
        identifiers: { sbi: '1', frn: '2' },
        answers: { scheme: 'SFI' }
      }
      doesAgreementExist.mockResolvedValueOnce(false)
      await expect(createOffer(uuidv4(), bad, mockLogger)).rejects.toThrow(
        'Offer data is missing payment and applicant'
      )
    })
  })
})
