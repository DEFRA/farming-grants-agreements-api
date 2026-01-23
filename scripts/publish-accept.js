import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { createLogger } from '~/src/api/common/helpers/logging/logger.js'

const logger = createLogger()

const sns = new SNSClient({
  region: 'eu-west-2',
  endpoint: 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
})

async function publishTestEvent() {
  const topicArn =
    'arn:aws:sns:eu-west-2:000000000000:grant_application_approved'

  const message = {
    id: 'xxxx-xxxx-xxxx-xxxx',
    source: 'fg-gas-backend',
    specVersion: '1.0',
    type: 'cloud.defra.test.fg-gas-backend.agreement.create',
    datacontenttype: 'application/json',
    data: {
      clientRef: 'ref-1234',
      code: 'frps-private-beta',
      createdAt: '2023-10-01T12:00:00Z',
      submittedAt: '2023-10-01T11:00:00Z',
      agreementName: "Joe's farm funding 2025",
      identifiers: {
        sbi: '900000005',
        frn: '1234567890',
        crn: '1234567890',
        defraId: '1234567890'
      },
      answers: {
        scheme: 'FPTT',
        year: 2025,
        hasCheckedLandIsUpToDate: true,
        actionApplications: [
          {
            parcelId: '0118',
            sheetId: 'AA0109',
            code: 'CSAM1',
            appliedFor: {
              unit: 'ha',
              quantity: 20.23
            }
          }
        ]
      },
      application: {
        parcel: [
          {
            sheetId: 'AA0100',
            parcelId: '0110',
            area: {
              unit: 'ha',
              quantity: 5.2182,
              _id: 'f00000000000000000000003'
            },
            actions: [
              {
                code: 'CMOR1',
                version: 1,
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 4.7575,
                  _id: 'f00000000000000000000005'
                },
                _id: 'f00000000000000000000004'
              },
              {
                code: 'UPL3',
                version: 1,
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 4.7575,
                  _id: 'f00000000000000000000021'
                },
                _id: 'f00000000000000000000020'
              }
            ],
            _id: 'f00000000000000000000002'
          },
          {
            sheetId: 'AA0101',
            parcelId: '0108',
            area: {
              unit: 'ha',
              quantity: 2.1703,
              _id: 'f00000000000000000000007'
            },
            actions: [
              {
                code: 'CMOR1',
                version: 1,
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 2.1705,
                  _id: 'f00000000000000000000009'
                },
                _id: 'f00000000000000000000008'
              },
              {
                code: 'UPL1',
                version: 1,
                durationYears: 3,
                appliedFor: {
                  unit: 'ha',
                  quantity: 2.1705,
                  _id: 'f00000000000000000000023'
                },
                _id: 'f00000000000000000000022'
              }
            ],
            _id: 'f00000000000000000000006'
          }
        ],
        agreement: [],
        _id: 'f00000000000000000000001'
      }
    }
  }

  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message)
    })
  )

  logger.info('Published test grant_application_approved event')
}

publishTestEvent().catch((err) => logger.error(err))
