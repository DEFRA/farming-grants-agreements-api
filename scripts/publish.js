/* eslint-disable n/no-unpublished-import */
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { createLogger } from '../src/api/common/helpers/logging/logger.js'

const logger = createLogger()

const sns = new SNSClient({
  region: 'eu-west-2',
  endpoint: 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
})

async function publishTestEvent() {
  const topicArn =
    'arn:aws:sns:eu-west-2:000000000000:application-approved-topic'

  const message = {
    eventType: 'ApplicationApproved',
    applicationId: 'APP-123456',
    sbi: '123456789',
    grantAmount: 30000
  }

  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message)
    })
  )

  logger.info('Published test ApplicationApproved event!')
}

publishTestEvent().catch((err) => logger.error(err))
