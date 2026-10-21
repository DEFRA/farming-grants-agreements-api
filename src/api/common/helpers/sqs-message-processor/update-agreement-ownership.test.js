import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import { Consumer } from 'sqs-consumer'
import { createSqsClientPlugin } from '../sqs-client.js'
import { handleUpdateAgreementEvent } from './update-agreement.js'
import { createAgreementWithGrantAndVersions } from '#~/api/agreement/helpers/create-agreement-with-grant-and-versions.js'
import { getAgreementDataById } from '#~/api/agreement/helpers/get-agreement-data.js'
import { withdrawOffer } from '#~/api/agreement/helpers/withdraw-offer.js'
import { cancelOffer } from '#~/api/agreement/helpers/cancel-offer.js'
import { terminateAgreement } from '#~/api/agreement/helpers/terminate-agreement.js'
import { publishEvent } from '../sns-publisher.js'
import agreementsModel from '#~/api/common/models/agreements.js'
import grantModel from '#~/api/common/models/grant.js'
import versionsModel from '#~/api/common/models/versions.js'

vi.mock('../sns-publisher.js')
vi.mock('../audit-event.js')
vi.mock('sqs-consumer', () => ({ Consumer: { create: vi.fn() } }))

const transitions = [
  { status: 'withdrawn', initialStatus: 'offered', transition: withdrawOffer },
  { status: 'cancelled', initialStatus: 'offered', transition: cancelOffer },
  {
    status: 'terminated',
    initialStatus: 'accepted',
    transition: terminateAgreement
  }
]
const clientRef = 'ownership-test-client'

describe('SQS status update ownership', () => {
  const logger = { info: vi.fn(), error: vi.fn() }

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'agreement-status-ownership-tests'
    })
  })

  afterAll(async () => {
    await mongoose.disconnect()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    await versionsModel.deleteMany({})
    await grantModel.deleteMany({})
    await agreementsModel.deleteMany({})
    publishEvent.mockResolvedValue(undefined)
    Consumer.create.mockReturnValue({
      on: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    })
  })

  const createVersion = async (agreementNumber, code, status) => {
    await createAgreementWithGrantAndVersions({
      agreement: {
        agreementNumber,
        clientRef,
        sbi: '106284736',
        frn: '1234567890'
      },
      versions: [
        {
          notificationMessageId: randomUUID(),
          correlationId: randomUUID(),
          clientRef,
          code,
          scheme: code === 'woodland' ? 'WMP' : 'SFI',
          identifiers: { sbi: '106284736', frn: '1234567890', crn: 'CRN1' },
          status,
          actionApplications: [],
          applicant: {
            business: { name: 'Test business', address: { city: 'Test city' } },
            customer: { name: { first: 'Test', last: 'Farmer' } }
          },
          application: { parcel: [] }
        }
      ]
    })
  }

  const processMessage = (agreementNumber, status) => {
    const { plugin, options } = createSqsClientPlugin(
      'ownership-test',
      'http://test-queue',
      handleUpdateAgreementEvent
    )
    const server = { logger, events: { on: vi.fn() } }
    plugin.register(server, options)
    const handleMessage = Consumer.create.mock.calls[0][0].handleMessage
    const message = {
      MessageId: randomUUID(),
      Body: JSON.stringify({
        type: 'gas-backend.agreement.update',
        data: { agreementNumber, clientRef, status }
      })
    }
    return { message, result: handleMessage(message) }
  }

  it.each(transitions)(
    'acknowledges ignored Woodland $status updates under an FPTT number',
    async ({ status, initialStatus }) => {
      await createVersion('FPTT123456789', 'woodland', initialStatus)
      const { message, result } = processMessage('FPTT123456789', status)

      await expect(result).resolves.toBe(message)
      expect(await getAgreementDataById('FPTT123456789')).toMatchObject({
        code: 'woodland',
        status: initialStatus
      })
      expect(publishEvent).not.toHaveBeenCalled()
    }
  )

  describe.each(['WMP123456789', 'SFI123456789'])(
    'FPTT version under parent %s',
    (agreementNumber) => {
      it.each(transitions)(
        'applies the $status update',
        async ({ status, initialStatus }) => {
          await createVersion(
            agreementNumber,
            'frps-private-beta',
            initialStatus
          )
          const { message, result } = processMessage(agreementNumber, status)

          await expect(result).resolves.toBe(message)
          expect(await getAgreementDataById(agreementNumber)).toMatchObject({
            code: 'frps-private-beta',
            status
          })
          expect(publishEvent).toHaveBeenCalledTimes(1)
          expect(publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                agreementNumber,
                code: 'frps-private-beta',
                status
              })
            }),
            logger
          )
        }
      )
    }
  )

  it.each(transitions)(
    'prevents a direct $status transition from mutating a Woodland version',
    async ({ transition, initialStatus }) => {
      await createVersion('FPTT123456789', 'woodland', initialStatus)

      await expect(transition(clientRef, 'FPTT123456789')).rejects.toThrow()
      expect(await getAgreementDataById('FPTT123456789')).toMatchObject({
        code: 'woodland',
        status: initialStatus
      })
    }
  )

  it('does not fall back to an older FPTT version when the latest is Woodland', async () => {
    await createVersion('FPTT123456789', 'frps-private-beta', 'offered')
    const olderVersion = await getAgreementDataById('FPTT123456789')
    await createVersion('FPTT123456789', 'woodland', 'offered')
    const { message, result } = processMessage('FPTT123456789', 'cancelled')

    await expect(result).resolves.toBe(message)
    expect(await getAgreementDataById('FPTT123456789')).toMatchObject({
      code: 'woodland',
      status: 'offered'
    })
    expect(await versionsModel.findById(olderVersion._id).lean()).toMatchObject(
      {
        code: 'frps-private-beta',
        status: 'offered'
      }
    )
    expect(publishEvent).not.toHaveBeenCalled()
  })

  it('rejects a missing agreement so its message remains eligible for retry', async () => {
    const { result } = processMessage('FPTT123456789', 'cancelled')
    await expect(result).rejects.toThrow()
    expect(publishEvent).not.toHaveBeenCalled()
  })
})
