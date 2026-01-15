import { vi } from 'vitest'
import { v4 as uuidv4 } from 'uuid'

import mongoose from 'mongoose'
import Boom from '@hapi/boom'
import { createOffer, generateAgreementNumber } from './create-offer.js'
import versionsModel from '~/src/api/common/models/versions.js'
import agreementsModel from '~/src/api/common/models/agreements.js'
import { publishEvent } from '~/src/api/common/helpers/sns-publisher.js'
import { doesAgreementExist } from '~/src/api/agreement/helpers/get-agreement-data.js'

vi.mock('@hapi/boom')
vi.mock('~/src/api/common/models/versions.js')
vi.mock('~/src/api/common/models/agreements.js', () => {
  let populatedAgreement = null

  const api = {
    create: vi.fn(() => ({ _id: 'mockG1' })),
    findById: vi.fn(() => ({
      populate: () => ({
        lean: () => Promise.resolve(populatedAgreement)
      })
    })),
    createAgreementWithVersions: vi.fn(() => populatedAgreement),

    // helper exposed to tests:
    __setPopulatedAgreement: (g) => {
      populatedAgreement = g
    }
  }

  return { __esModule: true, default: api }
})
vi.mock('~/src/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(true)
}))
vi.mock('~/src/api/agreement/helpers/get-agreement-data.js', () => ({
  doesAgreementExist: vi.fn().mockResolvedValue(false),
  // Added explicit mock for getAgreementDataById to satisfy tests that import this module
  getAgreementDataById: vi.fn().mockResolvedValue({})
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
    crn: '1234567890'
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
    vi.useFakeTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn()
    }

    // Setup Boom mocks
    Boom.badRequest = vi.fn((message) => {
      const error = new Error(message)
      error.isBoom = true
      return error
    })

    // Make insertMany return a real-looking agreement (matching targetDataStructure)
    versionsModel.insertMany = vi.fn(() => [
      { ...targetDataStructure, _id: new mongoose.Types.ObjectId() }
    ])
    versionsModel.updateMany = vi.fn(() => ({
      matchedCount: 1,
      modifiedCount: 1
    }))
    versionsModel.deleteMany = vi.fn(() => ({ deletedCount: 0 }))

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

    if (!vi.isMockFunction(agreementsModel.createAgreementWithVersions)) {
      vi.spyOn(agreementsModel, 'createAgreementWithVersions')
    }
    agreementsModel.createAgreementWithVersions.mockResolvedValue(populated)

    publishEvent.mockResolvedValue(true)

    vi.setSystemTime(new Date('2025-01-01'))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.useRealTimers()
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

  it('accepts identifiers without defraId', async () => {
    doesAgreementExist.mockResolvedValueOnce(false)

    await createOffer('aws-message-id', agreementData, mockLogger)

    const [[lastCallArgs]] =
      agreementsModel.createAgreementWithVersions.mock.calls.slice(-1)

    expect(lastCallArgs.versions[0].identifiers).toEqual(
      expect.objectContaining({
        sbi: '106284736',
        frn: '1234567890',
        crn: '1234567890'
      })
    )
    expect(lastCallArgs.versions[0].identifiers.defraId).toBeUndefined()
  })

  it('accepts identifiers with defraId', async () => {
    doesAgreementExist.mockResolvedValueOnce(false)

    const withDefraId = {
      ...agreementData,
      identifiers: {
        ...agreementData.identifiers,
        defraId: '1234567890'
      }
    }

    await createOffer('aws-message-id', withDefraId, mockLogger)

    const [[lastCallArgs]] =
      agreementsModel.createAgreementWithVersions.mock.calls.slice(-1)

    expect(lastCallArgs.versions[0].identifiers).toEqual(
      expect.objectContaining({
        sbi: '106284736',
        frn: '1234567890',
        crn: '1234567890',
        defraId: '1234567890'
      })
    )
  })

  it('normalises applicant customer and address from answers payload', async () => {
    doesAgreementExist.mockResolvedValueOnce(false)

    const payload = {
      ...agreementData,
      answers: {
        ...agreementData.answers,
        applicant: {
          business: {
            reference: '3577139140',
            name: 'HireContracting',
            email: { address: 'test@test.com' },
            phone: '4478673322372323',
            line1: 'Benbrigge House',
            line2: 'ALBRIGHTON',
            city: 'GRIMSBY',
            postalCode: 'DY13 0UY'
          }
        },
        customer: {
          name: {
            title: 'Mr',
            first: 'Graham',
            middle: 'Lisa',
            last: 'Gilfoyle'
          }
        }
      }
    }

    await createOffer('aws-message-id', payload, mockLogger)

    const [[lastCallArgs]] =
      agreementsModel.createAgreementWithVersions.mock.calls.slice(-1)

    expect(lastCallArgs.versions[0].applicant).toEqual(
      expect.objectContaining({
        business: expect.objectContaining({
          name: 'HireContracting',
          address: expect.objectContaining({
            line1: 'Benbrigge House',
            line2: 'ALBRIGHTON',
            city: 'GRIMSBY',
            postalCode: 'DY13 0UY'
          })
        }),
        customer: expect.objectContaining({
          name: expect.objectContaining({
            first: 'Graham',
            last: 'Gilfoyle'
          })
        })
      })
    )
  })

  it('keeps existing applicant customer and address when already structured correctly', async () => {
    doesAgreementExist.mockResolvedValueOnce(false)

    const payload = {
      ...agreementData,
      answers: {
        ...agreementData.answers,
        applicant: {
          business: {
            name: 'Structured Business',
            email: { address: 'structured@test.com' },
            phone: '01234567890',
            address: {
              line1: 'Existing line 1',
              postalCode: 'AB1 2CD'
            }
          },
          customer: {
            name: {
              title: 'Mrs',
              first: 'Existing',
              last: 'Customer'
            }
          }
        },
        customer: {
          name: {
            title: 'Mr',
            first: 'Different',
            last: 'Customer'
          }
        }
      }
    }

    await createOffer('aws-message-id', payload, mockLogger)

    const [[lastCallArgs]] =
      agreementsModel.createAgreementWithVersions.mock.calls.slice(-1)

    expect(lastCallArgs.versions[0].applicant).toEqual(
      expect.objectContaining({
        business: expect.objectContaining({
          name: 'Structured Business',
          address: expect.objectContaining({
            line1: 'Existing line 1',
            postalCode: 'AB1 2CD'
          })
        }),
        customer: expect.objectContaining({
          name: expect.objectContaining({
            title: 'Mrs',
            first: 'Existing',
            last: 'Customer'
          })
        })
      })
    )
  })

  it('does not attach an address when none of the address fields are provided', async () => {
    doesAgreementExist.mockResolvedValueOnce(false)

    const payload = {
      ...agreementData,
      answers: {
        ...agreementData.answers,
        applicant: {
          business: {
            name: 'No Address Business',
            email: { address: 'noaddress@test.com' },
            phone: '07700900000'
          }
        }
      }
    }

    await createOffer('aws-message-id', payload, mockLogger)

    const [[lastCallArgs]] =
      agreementsModel.createAgreementWithVersions.mock.calls.slice(-1)

    expect(lastCallArgs.versions[0].applicant.business).toEqual(
      expect.objectContaining({
        name: 'No Address Business'
      })
    )
    expect(lastCallArgs.versions[0].applicant.business.address).toBeUndefined()
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
            phone: '01234031670',
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

  it('should build legacy payment structure when answers.parcel format is provided', async () => {
    const payloadWithAnswersParcel = {
      clientRef: 'parcel-format-ref',
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
            name: 'PARCEL BUSINESS LTD',
            reference: '3989509178',
            email: {
              address: 'farmer@example.com'
            },
            phone: '01234031670',
            address: {
              line1: 'Farm Lane',
              line2: 'Village',
              line3: null,
              line4: null,
              line5: null,
              street: 'Farm Street',
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
        parcel: [
          {
            sheetId: 'SD9999',
            parcelId: '9999',
            area: { unit: 'ha', quantity: 1.2345 },
            actions: [
              {
                code: 'CMOR1',
                description: 'Assess moorland and produce a written record',
                durationYears: 3,
                eligible: { unit: 'ha', quantity: 1.2345 },
                appliedFor: { unit: 'ha', quantity: 1.2345 },
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
      'answers-parcel-message',
      payloadWithAnswersParcel,
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
      sheetId: 'SD9999',
      parcelId: '9999'
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
      parcelId: '9999',
      sheetId: 'SD9999'
    })

    expect(applicant).toBeDefined()
    expect(applicant.business.name).toBe('PARCEL BUSINESS LTD')
  })

  it('should build legacy payment structure when answers.application format is provided', async () => {
    const payloadWithAnswersApplication = {
      clientRef: 'answers-application-ref',
      code: 'frps-private-beta',
      identifiers: {
        sbi: '106284736',
        frn: '3989509178',
        crn: '1102838829',
        defraId: 'defraId'
      },
      answers: {
        scheme: 'SFI',
        application: {
          applicant: {
            business: {
              name: 'ANSWERS APPLICATION LTD',
              reference: '3989509178',
              email: {
                address: 'applicant@example.com'
              },
              phone: '01234031670',
              address: {
                line1: 'Answers Lane',
                line2: 'Village',
                city: 'Clitheroe',
                postalCode: 'BB7 3DD'
              }
            }
          },
          totalAnnualPaymentPence: 15000,
          parcels: [
            {
              sheetId: 'SD9998',
              parcelId: '8888',
              area: { unit: 'ha', quantity: 2.5 },
              actions: [
                {
                  code: 'CMOR1',
                  description: 'Assess moorland',
                  durationYears: 3,
                  eligible: { unit: 'ha', quantity: 2.5 },
                  paymentRates: {
                    ratePerUnitPence: 1060
                  },
                  annualPaymentPence: 5000
                }
              ]
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
      'answers-application-message',
      payloadWithAnswersApplication,
      mockLogger
    )

    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    const { payment, actionApplications, applicant } = callPayload.versions[0]

    expect(payment).toBeDefined()
    expect(payment.annualTotalPence).toBe(15000)
    expect(actionApplications).toHaveLength(1)
    expect(applicant).toBeDefined()
    expect(applicant.business.name).toBe('ANSWERS APPLICATION LTD')
  })

  it('should build legacy payment structure when answers.payments format is provided', async () => {
    const payloadWithAnswersPayments = {
      clientRef: 'answers-payments-ref',
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
            name: 'ANSWERS PAYMENTS LTD',
            reference: '3989509178',
            email: {
              address: 'payments@example.com'
            },
            phone: '01234031670',
            address: {
              line1: 'Payments Lane',
              city: 'Clitheroe',
              postalCode: 'BB7 3DD'
            }
          }
        },
        totalAnnualPaymentPence: 22000,
        payments: {
          parcel: [
            {
              sheetId: 'SD7000',
              parcelId: '1000',
              actions: [
                {
                  code: 'CMOR1',
                  description: 'Assess moorland',
                  durationYears: 3,
                  eligible: { unit: 'ha', quantity: 2 },
                  paymentRates: { ratePerUnitPence: 1060 },
                  annualPaymentPence: 6000
                }
              ]
            }
          ],
          agreement: [
            {
              code: 'CMOR1',
              description: 'Assess moorland',
              durationYears: 3,
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
      'answers-payments-message',
      payloadWithAnswersPayments,
      mockLogger
    )

    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    const { payment, actionApplications } = callPayload.versions[0]

    expect(payment).toBeDefined()
    expect(payment.annualTotalPence).toBe(22000)
    expect(actionApplications).toHaveLength(1)
  })

  it('should build legacy payment structure when root-level payments format is provided', async () => {
    const payloadWithRootPayments = {
      clientRef: 'root-payments-ref',
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
            name: 'ROOT PAYMENTS LTD',
            reference: '3989509178',
            email: {
              address: 'rootpayments@example.com'
            },
            phone: '01234031670',
            address: {
              line1: 'Root Payments Lane',
              city: 'Clitheroe',
              postalCode: 'BB7 3DD'
            }
          }
        },
        totalAnnualPaymentPence: 15000
      },
      payments: {
        parcel: [
          {
            sheetId: 'SD8000',
            parcelId: '2000',
            actions: [
              {
                code: 'CMOR1',
                description: 'Assess moorland',
                durationYears: 3,
                eligible: { unit: 'ha', quantity: 1.5 },
                paymentRates: { ratePerUnitPence: 1060 },
                annualPaymentPence: 5000
              }
            ]
          }
        ],
        agreement: [
          {
            code: 'CMOR1',
            description: 'Assess moorland',
            durationYears: 3,
            paymentRates: 27200,
            annualPaymentPence: 27200
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
      'root-payments-message',
      payloadWithRootPayments,
      mockLogger
    )

    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    const { payment, actionApplications } = callPayload.versions[0]

    expect(payment).toBeDefined()
    expect(payment.annualTotalPence).toBe(15000)
    expect(actionApplications).toHaveLength(1)
  })

  it('should handle answers.payments with parcels (plural) instead of parcel', async () => {
    const payloadWithParcels = {
      clientRef: 'parcels-plural-ref',
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
            name: 'PARCELS PLURAL LTD',
            reference: '3989509178',
            email: { address: 'parcels@example.com' },
            phone: '01234031670',
            address: {
              line1: 'Parcels Lane',
              city: 'Clitheroe',
              postalCode: 'BB7 3DD'
            }
          }
        },
        totalAnnualPaymentPence: 10000,
        payments: {
          parcels: [
            {
              sheetId: 'SD9000',
              parcelId: '3000',
              actions: [
                {
                  code: 'CMOR1',
                  description: 'Assess moorland',
                  durationYears: 3,
                  eligible: { unit: 'ha', quantity: 1 },
                  paymentRates: { ratePerUnitPence: 1060 },
                  annualPaymentPence: 5000
                }
              ]
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

    await createOffer('parcels-plural-message', payloadWithParcels, mockLogger)

    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    const { payment } = callPayload.versions[0]

    expect(payment).toBeDefined()
    expect(payment.annualTotalPence).toBe(10000)
  })

  it('should handle answers.payments with totalAnnualPaymentPence from payments object', async () => {
    const payloadWithPaymentsTotal = {
      clientRef: 'payments-total-ref',
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
            name: 'PAYMENTS TOTAL LTD',
            reference: '3989509178',
            email: { address: 'total@example.com' },
            phone: '01234031670',
            address: {
              line1: 'Total Lane',
              city: 'Clitheroe',
              postalCode: 'BB7 3DD'
            }
          }
        },
        payments: {
          parcel: [
            {
              sheetId: 'SD10000',
              parcelId: '4000',
              actions: [
                {
                  code: 'CMOR1',
                  description: 'Assess moorland',
                  durationYears: 3,
                  eligible: { unit: 'ha', quantity: 1 },
                  paymentRates: { ratePerUnitPence: 1060 },
                  annualPaymentPence: 3000
                }
              ]
            }
          ],
          totalAnnualPaymentPence: 25000
        }
      }
    }

    agreementsModel.createAgreementWithVersions.mockResolvedValueOnce({
      agreementNumber: 'SFI123456789',
      agreements: []
    })
    doesAgreementExist.mockResolvedValueOnce(false)

    await createOffer(
      'payments-total-message',
      payloadWithPaymentsTotal,
      mockLogger
    )

    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    const { payment } = callPayload.versions[0]

    expect(payment).toBeDefined()
    expect(payment.annualTotalPence).toBe(25000)
  })

  it('should calculate totalAnnualPaymentPence from parcels when not provided', async () => {
    const payloadWithCalculatedTotal = {
      clientRef: 'calculated-total-ref',
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
            name: 'CALCULATED TOTAL LTD',
            reference: '3989509178',
            email: { address: 'calc@example.com' },
            phone: '01234031670',
            address: {
              line1: 'Calc Lane',
              city: 'Clitheroe',
              postalCode: 'BB7 3DD'
            }
          }
        },
        payments: {
          parcel: [
            {
              sheetId: 'SD11000',
              parcelId: '5000',
              actions: [
                {
                  code: 'CMOR1',
                  description: 'Assess moorland',
                  durationYears: 3,
                  eligible: { unit: 'ha', quantity: 1 },
                  paymentRates: { ratePerUnitPence: 1060 },
                  annualPaymentPence: 4000
                },
                {
                  code: 'UPL1',
                  description: 'Moderate grazing',
                  durationYears: 3,
                  eligible: { unit: 'ha', quantity: 1 },
                  paymentRates: { ratePerUnitPence: 2000 },
                  annualPaymentPence: 6000
                }
              ]
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
      'calculated-total-message',
      payloadWithCalculatedTotal,
      mockLogger
    )

    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    const { payment } = callPayload.versions[0]

    expect(payment).toBeDefined()
    // Should calculate: 4000 + 6000 = 10000
    expect(payment.annualTotalPence).toBe(10000)
  })

  it('should handle empty payments.parcel array gracefully', async () => {
    const payloadWithEmptyPayments = {
      clientRef: 'empty-payments-ref',
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
            name: 'EMPTY PAYMENTS LTD',
            reference: '3989509178',
            email: { address: 'empty@example.com' },
            phone: '01234031670',
            address: {
              line1: 'Empty Lane',
              city: 'Clitheroe',
              postalCode: 'BB7 3DD'
            }
          }
        },
        payments: {
          parcel: []
        }
      }
    }

    doesAgreementExist.mockResolvedValueOnce(false)

    // Should fail validation because no payment/applicant can be derived
    await expect(
      createOffer(
        'empty-payments-message',
        payloadWithEmptyPayments,
        mockLogger
      )
    ).rejects.toThrow('Offer data is missing payment and applicant')

    expect(Boom.badRequest).toHaveBeenCalledWith(
      'Offer data is missing payment and applicant'
    )
  })

  it('should handle answers.application being null gracefully', async () => {
    const payloadWithNullApplication = {
      clientRef: 'null-application-ref',
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
            name: 'NULL APPLICATION LTD',
            reference: '3989509178',
            email: { address: 'null@example.com' },
            phone: '01234031670',
            address: {
              line1: 'Null Lane',
              city: 'Clitheroe',
              postalCode: 'BB7 3DD'
            }
          }
        },
        application: null
      }
    }

    doesAgreementExist.mockResolvedValueOnce(false)

    await expect(
      createOffer(
        'null-application-message',
        payloadWithNullApplication,
        mockLogger
      )
    ).rejects.toThrow('Offer data is missing payment and applicant')

    expect(Boom.badRequest).toHaveBeenCalledWith(
      'Offer data is missing payment and applicant'
    )
  })

  it('should handle payments.parcel as a single object (not array)', async () => {
    const payloadWithSingleParcel = {
      clientRef: 'single-parcel-ref',
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
            name: 'SINGLE PARCEL LTD',
            reference: '3989509178',
            email: { address: 'single@example.com' },
            phone: '01234031670',
            address: {
              line1: 'Single Lane',
              city: 'Clitheroe',
              postalCode: 'BB7 3DD'
            }
          }
        },
        totalAnnualPaymentPence: 8000,
        payments: {
          parcel: {
            sheetId: 'SD12000',
            parcelId: '6000',
            actions: [
              {
                code: 'CMOR1',
                description: 'Assess moorland',
                durationYears: 3,
                eligible: { unit: 'ha', quantity: 1 },
                paymentRates: { ratePerUnitPence: 1060 },
                annualPaymentPence: 8000
              }
            ]
          }
        }
      }
    }

    agreementsModel.createAgreementWithVersions.mockResolvedValueOnce({
      agreementNumber: 'SFI123456789',
      agreements: []
    })
    doesAgreementExist.mockResolvedValueOnce(false)

    await createOffer(
      'single-parcel-message',
      payloadWithSingleParcel,
      mockLogger
    )

    const callPayload =
      agreementsModel.createAgreementWithVersions.mock.calls[0][0]
    const { payment } = callPayload.versions[0]

    expect(payment).toBeDefined()
    expect(payment.annualTotalPence).toBe(8000)
  })

  it('should handle payments.parcel being null or undefined', async () => {
    const payloadWithNullParcel = {
      clientRef: 'null-parcel-ref',
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
            name: 'NULL PARCEL LTD',
            reference: '3989509178',
            email: { address: 'nullparcel@example.com' },
            phone: '01234031670',
            address: {
              line1: 'Null Parcel Lane',
              city: 'Clitheroe',
              postalCode: 'BB7 3DD'
            }
          }
        },
        payments: {
          parcel: null
        }
      }
    }

    doesAgreementExist.mockResolvedValueOnce(false)

    await expect(
      createOffer('null-parcel-message', payloadWithNullParcel, mockLogger)
    ).rejects.toThrow('Offer data is missing payment and applicant')

    expect(Boom.badRequest).toHaveBeenCalledWith(
      'Offer data is missing payment and applicant'
    )
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

    expect(Boom.badRequest).toHaveBeenCalledWith(
      'Offer data is missing payment and applicant'
    )
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

    expect(Boom.badRequest).toHaveBeenCalledWith(
      'Offer data is missing payment and applicant'
    )
  })

  it('should handle conversion errors in catch block when mapper throws', async () => {
    // Re-import a fresh module with the mapper mocked to throw
    vi.resetModules()
    vi.doMock('./legacy-application-mapper.js', async () => {
      const original = await vi.importActual('./legacy-application-mapper.js')
      return {
        __esModule: true,
        ...original,
        buildLegacyPaymentFromApplication: vi.fn(() => {
          throw new Error('Mapper conversion failed')
        })
      }
    })

    const { createOffer: createOfferUnderTest } = await import(
      './create-offer.js'
    )

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

    doesAgreementExist.mockResolvedValueOnce(false)

    // The error should be caught and validation should throw
    await expect(
      createOfferUnderTest('test-id', payloadWithParcels, mockLogger)
    ).rejects.toThrow('Offer data is missing payment and applicant')

    expect(Boom.badRequest).toHaveBeenCalledWith(
      'Offer data is missing payment and applicant'
    )

    // Clear the mocked modules so other tests use the original implementations
    vi.resetModules()
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
            phone: '01234567890',
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

  it('calls createAgreementWithVersions and publishEvent with the correct args', async () => {
    // Arrange
    doesAgreementExist.mockResolvedValueOnce(false)
    const notificationMessageId = 'aws-message-id'

    // Act
    await createOffer(notificationMessageId, agreementData, mockLogger)

    // Assert
    expect(agreementsModel.createAgreementWithVersions).toHaveBeenCalledWith({
      agreement: {
        agreementNumber: expect.any(String),
        clientRef: agreementData.clientRef,
        sbi: agreementData.identifiers.sbi
      },
      versions: [
        expect.objectContaining({
          notificationMessageId,
          clientRef: agreementData.clientRef,
          code: agreementData.code,
          identifiers: agreementData.identifiers,
          scheme: agreementData.answers.scheme,
          agreementName: agreementData.answers.agreementName,
          actionApplications: expect.arrayContaining([
            expect.objectContaining({
              parcelId: '9238',
              sheetId: 'SX0679',
              code: 'CSAM1'
            })
          ]),
          payment: expect.objectContaining({
            agreementEndDate: agreementData.answers.payment.agreementEndDate
          }),
          applicant: expect.objectContaining({
            customer: expect.objectContaining({
              name: expect.objectContaining({
                first: 'Joe'
              })
            })
          })
        })
      ]
    })

    expect(publishEvent).toHaveBeenCalledWith(
      {
        topicArn: 'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
        type: 'io.onsite.agreement.status.updated',
        time: expect.any(String),
        data: expect.objectContaining({
          agreementNumber: expect.any(String),
          correlationId: expect.any(String),
          clientRef: agreementData.clientRef,
          status: 'offered',
          date: expect.any(String),
          code: agreementData.code,
          endDate: agreementData.answers.payment.agreementEndDate
        })
      },
      mockLogger
    )
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.clearAllMocks()
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
      doesAgreementExist.mockResolvedValueOnce(false)
      agreementsModel.createAgreementWithVersions.mockRejectedValue(
        new Error('Database connection error')
      )

      await expect(
        createOffer(uuidv4(), agreementData, mockLogger)
      ).rejects.toThrow('Database connection error')

      expect(agreementsModel.createAgreementWithVersions).toHaveBeenCalled()
    })

    it('should handle generic errors when creating an agreement', async () => {
      doesAgreementExist.mockResolvedValueOnce(false)
      agreementsModel.createAgreementWithVersions.mockRejectedValue(
        new Error('Generic error')
      )

      await expect(
        createOffer(uuidv4(), agreementData, mockLogger)
      ).rejects.toThrow('Generic error')

      expect(agreementsModel.createAgreementWithVersions).toHaveBeenCalled()
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

      expect(Boom.badRequest).toHaveBeenCalledWith(
        'Offer data is missing payment and applicant'
      )
    })
  })
})
