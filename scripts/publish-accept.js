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
    type: 'cloud.defra.dev.fg-gas-backend.application.approved',
    datacontenttype: 'application/json',
    data: {
      clientRef: 'ref-1234',
      code: 'frps-private-beta',
      createdAt: '2023-10-01T12:00:00Z',
      submittedAt: '2023-10-01T11:00:00Z',
      agreementName: "Joe's farm funding 2025",
      identifiers: {
        sbi: '106284736',
        frn: '1234567890',
        crn: '1234567890',
        defraId: '1234567890'
      },
      answers: {
        scheme: 'SFI',
        year: 2025,
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
          }
        ]
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
